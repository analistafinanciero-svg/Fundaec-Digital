class DocuFlowApp {
    constructor() {
        // Cambiamos la clave para RESETEAR y corregir errores de versiones previas
        this.STORAGE_KEY = 'docuflow_v3_stable';
        this.explorerState = { year: null, month: null, filterCatId: null };
        this.currentMoveDocId = null;
        this.loadData();
        this.currentUser = this.data.users[0];
        this.init();
    }

    loadData() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        try {
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.categories && parsed.categories.length > 0) {
                    this.data = parsed;
                    // Asegurar que todas las listas existan
                    if (!this.data.auditLogs) this.data.auditLogs = [];
                    if (!this.data.types) this.data.types = [];
                    if (!this.data.documents) this.data.documents = [];
                    if (!this.data.users) this.data.users = [{ id: 1, name: 'Admin Principal', role: 'Administrador', status: 'Activo' }];
                    return;
                }
            }
        } catch (e) {
            console.error("Error cargando LocalStorage:", e);
        }
        this.setDefaultData();
    }

    setDefaultData() {
        this.data = {
            categories: [
                { id: 1, name: 'Facturación', icon: '🧾', nextConsecutive: 1, color: '#4f46e5' },
                { id: 2, name: 'Legal', icon: '⚖️', nextConsecutive: 1, color: '#10b981' },
                { id: 3, name: 'Laboral', icon: '👤', nextConsecutive: 1, color: '#f59e0b' }
            ],
            types: [
                { id: 1, catId: 1, name: 'Factura' },
                { id: 2, catId: 1, name: 'Comprobante' },
                { id: 3, catId: 2, name: 'Contrato' },
                { id: 4, catId: 3, name: 'Nómina' }
            ],
            documents: [],
            users: [
                { id: 1, name: 'Admin Principal', role: 'Administrador', status: 'Activo' }
            ],
            auditLogs: []
        };
        this.save();
    }

    save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    }

    init() {
        // Registro de manejadores con protección contra elementos nulos
        this.setupNavigation();
        this.setupConfigHandlers();
        this.setupUploadLogic();
        this.setupNotifications();
        this.setupSearch();
        this.setupUserHandlers();
        this.setupMisc();

        // Renderizado inicial forzado
        this.renderAll();
    }

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.onclick = () => {
                const viewId = item.getAttribute('data-view');
                this.switchView(viewId);
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            };
        });
    }

    switchView(viewId) {
        document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
        const target = document.getElementById(`view-${viewId}`);
        if (target) {
            target.classList.add('active');
            if (viewId === 'explorer') this.renderExplorer();
            if (viewId === 'dashboard') this.renderDashboard();
            if (viewId === 'users') this.renderUsers();
        }
    }

    renderAll() {
        this.renderCategorySelectors();
        this.renderConfigLists();
        this.renderDashboard();
        this.updateStats();
        this.renderAuditLogs();
        this.renderUsers();
    }

    renderCategorySelectors() {
        const selects = ['meta-category', 'config-select-cat', 'move-category'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = '<option value="">Selecciona...</option>' +
                    this.data.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            }
        });
    }

    renderDashboard() {
        const tileGrid = document.getElementById('storage-tile-grid');
        const recentGrid = document.getElementById('recent-files-grid');
        const legend = document.getElementById('legend-list');

        if (tileGrid) {
            tileGrid.innerHTML = this.data.categories.map(cat => {
                const count = this.data.documents.filter(d => d.catId === cat.id).length;
                return `
                    <div class="storage-box">
                        <div class="icon" style="background:${cat.color}20; color:${cat.color}">${cat.icon}</div>
                        <h4>${cat.name}</h4>
                        <p>${count} documentos</p>
                    </div>`;
            }).join('');
        }

        if (recentGrid) {
            const recent = [...this.data.documents].reverse().slice(0, 6);
            recentGrid.innerHTML = recent.length > 0
                ? recent.map(doc => this.createFileCardHTML(doc)).join('')
                : '<p style="grid-column:1/-1; opacity:0.5; text-align:center;">No hay archivos aún</p>';
        }

        if (legend) {
            legend.innerHTML = this.data.categories.map(cat => {
                const count = this.data.documents.filter(d => d.catId === cat.id).length;
                return `<div class="legend-item"><span><i class="color-dot" style="background:${cat.color}"></i> ${cat.name}</span><strong>${count}</strong></div>`;
            }).join('');
        }
    }

    createFileCardHTML(doc) {
        const cat = this.data.categories.find(c => c.id === doc.catId);
        return `
            <div class="file-card">
                <div class="file-preview">📄</div>
                <div class="file-info">
                    <h4 title="${doc.name}">${doc.name}</h4>
                    <p>#${doc.consecutive} • ${cat?.name || 'Gral'}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
                        <span style="font-size:0.75rem;">${doc.timestamp.split(',')[0]}</span>
                        <div style="display:flex; gap:0.5rem;">
                            <button onclick="app.openPreview(${doc.id})">👁️</button>
                            <button style="color:red" onclick="app.deleteDocument(${doc.id})">🗑️</button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    setupUploadLogic() {
        const form = document.getElementById('doc-upload-form');
        const selCat = document.getElementById('meta-category');
        const selType = document.getElementById('meta-type');
        const inpCons = document.getElementById('meta-consecutive');
        const fileInp = document.getElementById('file-input');

        if (selCat) {
            selCat.onchange = () => {
                const cat = this.data.categories.find(c => c.id == selCat.value);
                if (cat) {
                    selType.disabled = false;
                    selType.innerHTML = this.data.types.filter(t => t.catId == cat.id).map(t => `<option value="${t.id}">${t.name}</option>`).join('');
                    inpCons.value = cat.nextConsecutive;
                }
            };
        }

        if (fileInp) {
            fileInp.onchange = () => {
                const label = document.getElementById('file-count-label');
                if (label) label.textContent = `${fileInp.files.length} archivos seleccionados`;
            };
        }

        const dropzone = document.getElementById('dropzone');
        if (dropzone && fileInp) {
            dropzone.onclick = () => fileInp.click();
        }

        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                const files = fileInp.files;
                if (!files.length) return alert('Por favor, selecciona al menos un archivo PDF.');

                const catId = selCat.value;
                const cat = this.data.categories.find(c => c.id == catId);
                const typeId = selType.value;
                const dateVal = document.getElementById('meta-date').value;

                if (!cat) return alert('Por favor, selecciona una Categoría.');
                if (!dateVal) return alert('Por favor, selecciona Año y Mes (Fecha).');

                const loader = document.getElementById('loader-overlay');
                const progress = document.getElementById('upload-progress');
                const loaderText = document.getElementById('loader-text');

                if (loader) loader.style.display = 'flex';
                if (progress) progress.style.width = '0%';

                const cons = parseInt(inpCons.value);
                const baseName = document.getElementById('meta-name').value;
                const date = document.getElementById('meta-date').value;

                let done = 0;
                Array.from(files).forEach((file, i) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        this.data.documents.push({
                            id: Date.now() + i,
                            name: baseName + (files.length > 1 ? ` (P${i + 1})` : ''),
                            catId: cat.id,
                            typeId: typeId,
                            consecutive: cons,
                            date: date,
                            timestamp: new Date().toLocaleString(),
                            content: ev.target.result
                        });
                        done++;
                        const percent = Math.round((done / files.length) * 100);
                        if (progress) progress.style.width = percent + '%';
                        if (loaderText) loaderText.textContent = `Cargando archivos (${percent}%)`;

                        if (done === files.length) {
                            setTimeout(() => {
                                if (cons >= cat.nextConsecutive) cat.nextConsecutive = cons + 1;
                                if (loader) loader.style.display = 'none';
                                this.addNotification(`Lote #${cons} archivado correctamente`, 'success');
                                alert('¡Documentos archivados!');
                                document.getElementById('upload-modal').style.display = 'none';
                                form.reset();
                                const label = document.getElementById('file-count-label');
                                if (label) label.textContent = 'Seleccionar PDFs';
                                this.save();
                                this.renderAll();
                            }, 800);
                        }
                    };
                    reader.readAsDataURL(file);
                });
            };
        }
    }

    setupNotifications() {
        const bell = document.getElementById('bell-icon');
        const panel = document.getElementById('notification-panel');
        if (bell && panel) {
            bell.onclick = (e) => {
                e.stopPropagation();
                panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
                document.getElementById('notification-dot').style.display = 'none';
            };
            document.onclick = () => panel.style.display = 'none';
        }
    }

    addNotification(text, type) {
        const list = document.getElementById('notification-list');
        const dot = document.getElementById('notification-dot');
        const bell = document.getElementById('bell-icon');
        if (!list) return;
        if (list.querySelector('p')) list.innerHTML = '';

        const item = document.createElement('div');
        item.className = 'notification-item';
        item.style.borderLeft = `4px solid ${type === 'success' ? '#10b981' : '#f43f5e'}`;
        item.innerHTML = `<strong>${text}</strong><br><small>${new Date().toLocaleTimeString()}</small>`;
        list.prepend(item);

        if (dot) dot.style.display = 'block';
        if (bell) {
            bell.classList.add('bell-wiggle');
            setTimeout(() => bell.classList.remove('bell-wiggle'), 600);
        }

        // Registrar en el log de auditoría
        this.data.auditLogs.push({
            time: new Date().toLocaleString(),
            action: type === 'success' ? 'Éxito' : 'Alerta',
            details: text
        });
        this.save();
        this.renderAuditLogs();
        this.showToast(text);
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            background: #1e293b;
            color: white;
            padding: 1rem 2rem;
            border-radius: 30px;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
            z-index: 9999;
            font-size: 0.9rem;
            animation: slideUp 0.3s ease;
        `;
        toast.innerHTML = `✅ ${message}`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideDown 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    updateStats() {
        const total = this.data.documents.length;
        const countEl = document.getElementById('total-docs-count');
        const prog = document.getElementById('storage-progress');
        if (countEl) countEl.textContent = total;
        if (prog) prog.style.width = Math.min(100, total * 5) + '%';
        const val = document.getElementById('storage-val');
        if (val) val.textContent = (total * 0.1).toFixed(1) + ' GB';
    }

    renderAuditLogs() {
        const body = document.getElementById('audit-table-body');
        if (body) {
            body.innerHTML = this.data.auditLogs.slice(-5).reverse().map(l => `
                <tr><td>${l.time.split(',')[1]}</td><td>${l.action}</td><td>${l.details}</td></tr>
            `).join('');
        }
    }

    setupSearch() {
        const s = document.querySelector('.search-bar input');
        if (s) {
            s.oninput = (e) => {
                const q = e.target.value.toLowerCase();
                if (q.length > 0) {
                    this.switchView('explorer');
                    const filtered = this.data.documents.filter(d => d.name.toLowerCase().includes(q) || d.consecutive.toString().includes(q));
                    document.getElementById('explorer-grid').innerHTML = filtered.map(d => this.createFileCardHTML(d)).join('');
                } else {
                    this.renderExplorer();
                }
            };
        }
    }

    setupUserHandlers() {
        const form = document.getElementById('user-form');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                const name = document.getElementById('user-name').value;
                const role = document.getElementById('user-role').value;

                this.data.users.push({
                    id: Date.now(),
                    name: name,
                    role: role,
                    status: 'Activo'
                });

                this.save();
                this.renderUsers();
                this.addNotification(`Usuario ${name} creado`, 'success');
                document.getElementById('user-modal').style.display = 'none';
                form.reset();
            };
        }
    }

    renderUsers() {
        const body = document.getElementById('users-table-body');
        if (!body) return;

        body.innerHTML = this.data.users.map(user => `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:1rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <div style="width:32px; height:32px; border-radius:50%; background:#e0e7ff; color:#4f46e5; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.8rem;">
                            ${user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <strong>${user.name}</strong>
                    </div>
                </td>
                <td><span style="background:#f1f5f9; padding:0.2rem 0.5rem; border-radius:4px; font-size:0.8rem;">${user.role}</span></td>
                <td><span style="color:#10b981; font-size:0.8rem;">● ${user.status}</span></td>
                <td>
                    ${user.id !== 1 ? `<button onclick="app.deleteUser(${user.id})" style="background:none; border:none; color:#f43f5e; cursor:pointer;">Eliminar</button>` : '<small style="color:#94a3b8">Sistema</small>'}
                </td>
            </tr>
        `).join('');
    }

    deleteUser(id) {
        if (id === 1) return;
        if (confirm('¿Eliminar este usuario?')) {
            this.data.users = this.data.users.filter(u => u.id !== id);
            this.save();
            this.renderUsers();
            this.addNotification('Usuario eliminado', 'error');
        }
    }

    // Estado del explorador para navegación Year > Month
    explorerState = {
        year: null,
        month: null,
        filterCatId: null
    };

    viewYear(y) {
        this.explorerState.year = y;
        this.explorerState.month = null;
        this.explorerState.filterCatId = null;
        this.renderExplorer();
    }

    viewMonth(m) {
        this.explorerState.month = m;
        this.explorerState.filterCatId = null;
        this.renderExplorer();
    }

    viewCat(c) {
        this.explorerState.filterCatId = parseInt(c);
        this.renderExplorer();
    }

    resetExplorer() {
        this.explorerState = { year: null, month: null, filterCatId: null };
        this.renderExplorer();
    }

    renderExplorer() {
        const grid = document.getElementById('explorer-grid');
        if (!grid) return;

        const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        // GENERAR BREADCRUMBS
        let bcHtml = `<div class="storage-box" style="grid-column:1/-1; background:var(--primary-light); padding:0.8rem 1.5rem; display:flex; gap:0.5rem; align-items:center; font-size:0.9rem; margin-bottom:1rem;">
            <span style="cursor:pointer; color:var(--primary); font-weight:600;" onclick="app.resetExplorer()">📁 Inicio</span>`;

        if (this.explorerState.year) {
            bcHtml += ` <span>/</span> <span style="cursor:pointer; color:var(--primary);" onclick="app.viewYear('${this.explorerState.year}')">${this.explorerState.year}</span>`;
        }
        if (this.explorerState.month) {
            bcHtml += ` <span>/</span> <span style="cursor:pointer; color:var(--primary);" onclick="app.viewMonth('${this.explorerState.month}')">${months[this.explorerState.month - 1]}</span>`;
        }
        if (this.explorerState.filterCatId) {
            const cName = this.data.categories.find(c => c.id == this.explorerState.filterCatId)?.name || 'Cat';
            bcHtml += ` <span>/</span> <span style="font-weight:700;">${cName}</span>`;
        }
        bcHtml += `</div>`;

        if (this.explorerState.year === null) {
            // Nivel Años
            const years = [...new Set(this.data.documents.map(d => d.date.split('-')[0]))].sort().reverse();
            grid.innerHTML = (years.length === 0)
                ? '<p style="grid-column:1/-1; text-align:center; padding:3rem; opacity:0.5;">No hay documentos archivados aún.</p>'
                : years.map(y => `
                    <div class="storage-box" style="text-align:center; cursor:pointer;" onclick="app.viewYear('${y}')">
                        <div style="font-size:3.5rem; margin-bottom:1rem;">📅</div>
                        <h4>${y}</h4>
                        <p>${this.data.documents.filter(d => d.date.startsWith(y)).length} Archivos</p>
                    </div>`).join('');
        } else if (this.explorerState.month === null) {
            // Nivel Meses
            const docsInYear = this.data.documents.filter(d => d.date.startsWith(this.explorerState.year));
            const availableMonths = [...new Set(docsInYear.map(d => parseInt(d.date.split('-')[1])))].sort((a, b) => a - b);
            grid.innerHTML = bcHtml + availableMonths.map(m => `
                <div class="storage-box" style="text-align:center; cursor:pointer;" onclick="app.viewMonth('${m}')">
                    <div style="font-size:3rem; margin-bottom:1rem;">📁</div>
                    <h4>${months[m - 1]}</h4>
                    <p>${docsInYear.filter(d => parseInt(d.date.split('-')[1]) === m).length} Archivos</p>
                </div>`).join('');
        } else if (this.explorerState.filterCatId === null) {
            // Nivel Categorías
            const mLabel = this.explorerState.month.toString().padStart(2, '0');
            const docsInMonth = this.data.documents.filter(d => d.date.startsWith(`${this.explorerState.year}-${mLabel}`));

            grid.innerHTML = bcHtml + this.data.categories.map(cat => {
                const count = docsInMonth.filter(d => d.catId == cat.id).length;
                return `
                    <div class="storage-box" style="text-align:center; cursor:pointer; min-height:160px; display:flex; flex-direction:column; align-items:center; justify-content:center;" onclick="app.viewCat('${cat.id}')">
                        <div class="icon" style="background:${cat.color}20; color:${cat.color}; width:50px; height:50px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:1rem; font-size:1.5rem;">${cat.icon || '📂'}</div>
                        <h4>${cat.name}</h4>
                        <p style="font-size:0.8rem; color:var(--text-body);">${count} archivos</p>
                    </div>`;
            }).join('');
        } else {
            // Nivel Tabla
            this.renderDocumentTable(bcHtml);
        }
    }

    getFileTypeIcon(filename) {
        const name = filename.toLowerCase();
        if (name.includes('factura') || name.endsWith('.pdf')) return '📕';
        if (name.includes('excel') || name.includes('contabilidad') || name.endsWith('.xlsx')) return '📗';
        if (name.includes('foto') || name.includes('captura') || name.endsWith('.jpg') || name.endsWith('.png')) return '🖼️';
        return '📄';
    }

    renderDocumentTable(bcHtml) {
        const grid = document.getElementById('explorer-grid');
        const year = this.explorerState.year;
        const monthFilter = this.explorerState.month.toString().padStart(2, '0');
        const catId = this.explorerState.filterCatId;

        let docs = this.data.documents.filter(d => d.date.startsWith(`${year}-${monthFilter}`) && d.catId == catId);

        let html = bcHtml + `
            <div style="grid-column:1/-1; background:white; padding:1.5rem; border-radius:var(--radius-md); box-shadow:var(--shadow);">
                <table class="file-table" style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead style="background:#f8fafc;">
                        <tr style="border-bottom:2px solid #eee;">
                            <th style="padding:1rem;">Tipo</th>
                            <th>Nombre</th>
                            <th>Consecutivo</th>
                            <th>Fecha</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${docs.map(doc => `
                            <tr style="border-bottom:1px solid #f1f5f9;">
                                <td style="padding:1rem; font-size:1.5rem;">${this.getFileTypeIcon(doc.name)}</td>
                                <td><strong>${doc.name}</strong></td>
                                <td><span style="font-weight:700; color:var(--primary);">#${doc.consecutive}</span></td>
                                <td style="font-size:0.85rem;">${doc.date}</td>
                                <td>
                                    <button onclick="app.openPreview(${doc.id})" title="Ver" style="background:none; border:none; cursor:pointer; font-size:1.2rem;">👁️</button>
                                    <button onclick="app.openMoveCopyModal(${doc.id})" title="Mover/Copiar" style="background:none; border:none; cursor:pointer; font-size:1.2rem; margin-left:0.5rem;">🔁</button>
                                    <button onclick="app.deleteDocument(${doc.id})" title="Eliminar" style="background:none; border:none; cursor:pointer; color:red; margin-left:0.5rem; font-size:1.2rem;">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
        grid.innerHTML = html;
    }

    setupMisc() {
        // Exportación de auditoría real
        const btnAudit = document.getElementById('btn-export-audit');
        if (btnAudit) {
            btnAudit.onclick = () => {
                if (this.data.auditLogs.length === 0) return alert('No hay registros para exportar');
                this.exportToCSV();
            };
        }

        // Exportación de reportes básica
        const btnRep = document.getElementById('btn-export-excel');
        if (btnRep) btnRep.onclick = () => alert('Reporte generado para Excel');
    }

    exportToCSV() {
        const headers = ["Fecha/Hora", "Acción", "Detalles"];
        const rows = this.data.auditLogs.map(l => [
            `"${l.time}"`,
            `"${l.action}"`,
            `"${l.details}"`
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.setAttribute("href", url);
        link.setAttribute("download", `auditoria_docuflow_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.addNotification('Auditoría exportada correctamente', 'success');
    }

    openPreview(id) {
        const doc = this.data.documents.find(d => d.id == id);
        if (!doc) return;
        document.getElementById('pdf-modal').style.display = 'flex';
        document.getElementById('pdf-preview-frame').src = doc.content;
    }

    closePreview() {
        document.getElementById('pdf-modal').style.display = 'none';
        document.getElementById('pdf-preview-frame').src = '';
    }

    setupConfigHandlers() {
        const btnCat = document.getElementById('btn-add-cat');
        const btnType = document.getElementById('btn-add-type');
        const configSelCat = document.getElementById('config-select-cat');

        if (btnCat) {
            btnCat.onclick = () => {
                const nameInp = document.getElementById('new-cat-name');
                if (!nameInp.value) return;
                this.data.categories.push({
                    id: Date.now(),
                    name: nameInp.value,
                    icon: '📂',
                    nextConsecutive: 1,
                    color: '#4f46e5'
                });
                this.save();
                this.renderAll();
                nameInp.value = '';
            };
        }

        if (btnType) {
            btnType.onclick = () => {
                const catId = configSelCat.value;
                const nameInp = document.getElementById('new-type-name');
                if (!catId || !nameInp.value) return alert('Selecciona categoría y nombre');
                this.data.types.push({
                    id: Date.now(),
                    catId: parseInt(catId),
                    name: nameInp.value
                });
                this.save();
                this.renderAll();
                nameInp.value = '';
            };
        }

        if (configSelCat) {
            configSelCat.onchange = () => this.renderConfigLists();
        }
    }

    renderConfigLists() {
        const catList = document.getElementById('cat-list');
        const typeList = document.getElementById('type-list');
        const configSelCat = document.getElementById('config-select-cat');

        if (catList) {
            catList.innerHTML = this.data.categories.map(c => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:0.5rem 1rem; border-radius:8px; margin-bottom:0.5rem; border:1px solid #eef2ff;">
                    <span>${c.icon} ${c.name}</span>
                    <button onclick="app.deleteCat(${c.id})" style="color:#f43f5e; border:none; background:none; cursor:pointer;">🗑️</button>
                </div>
            `).join('');
        }

        if (typeList && configSelCat && configSelCat.value) {
            const catId = configSelCat.value;
            const types = this.data.types.filter(t => t.catId == catId);
            typeList.innerHTML = types.length > 0
                ? types.map(t => `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:0.5rem 1rem; border-radius:8px; margin-bottom:0.5rem; border:1px solid #eef2ff;">
                        <span>📎 ${t.name}</span>
                        <button onclick="app.deleteType(${t.id})" style="color:#94a3b8; border:none; background:none; cursor:pointer;">&times;</button>
                    </div>`).join('')
                : '<p style="font-size:0.7rem; color:#94a3b8; text-align:center;">No hay tipos configurados</p>';
        } else if (typeList) {
            typeList.innerHTML = '<p style="font-size:0.7rem; color:#94a3b8; text-align:center;">Selecciona una categoría primero</p>';
        }
    }

    deleteCat(id) {
        if (confirm('¿Eliminar categoría? Se perderán los tipos pero no los documentos.')) {
            this.data.categories = this.data.categories.filter(c => c.id != id);
            this.save();
            this.renderAll();
        }
    }

    deleteType(id) {
        this.data.types = this.data.types.filter(t => t.id != id);
        this.save();
        this.renderAll();
    }

    openMoveCopyModal(id) {
        const doc = this.data.documents.find(d => d.id == id);
        if (!doc) return;
        this.currentMoveDocId = id;
        document.getElementById('move-title').innerText = `Acciones para: ${doc.name}`;

        // Pre-cargar valores actuales
        const [year, month] = doc.date.split('-');
        document.getElementById('move-year').value = year;
        document.getElementById('move-month').value = parseInt(month);
        document.getElementById('move-category').value = doc.catId;

        document.getElementById('move-modal').style.display = 'flex';
    }

    executeMoveCopy(action) {
        const doc = this.data.documents.find(d => d.id == this.currentMoveDocId);
        if (!doc) return;

        const newYear = document.getElementById('move-year').value;
        const newMonthNum = document.getElementById('move-month').value;
        const newCatId = document.getElementById('move-category').value;

        if (!newYear || !newMonthNum || !newCatId) {
            return alert('Completa todos los campos de destino.');
        }

        const destinyCat = this.data.categories.find(c => c.id == newCatId);
        if (!destinyCat) return alert('Categoría destino no válida.');

        const newDate = `${newYear}-${newMonthNum.toString().padStart(2, '0')}-01`;
        const actionLabel = action === 'copy' ? 'copiado' : 'movido';

        if (action === 'copy') {
            const newCopy = {
                ...doc,
                id: Date.now(),
                date: newDate,
                catId: parseInt(newCatId),
                consecutive: destinyCat.nextConsecutive++,
                timestamp: new Date().toLocaleString()
            };
            this.data.documents.push(newCopy);
        } else {
            doc.date = newDate;
            doc.catId = parseInt(newCatId);
            doc.consecutive = destinyCat.nextConsecutive++;
        }

        this.save();
        const finalMsg = action === 'copy' ? 'Se ha copiado exitosamente' : 'Se ha movido exitosamente';
        this.addNotification(finalMsg, 'success');

        this.renderAll();
        if (document.getElementById('view-explorer').classList.contains('active')) this.renderExplorer();
        document.getElementById('move-modal').style.display = 'none';
        this.currentMoveDocId = null;
    }

    deleteDocument(id) {
        if (confirm('¿Eliminar?')) {
            this.data.documents = this.data.documents.filter(d => d.id != id);
            this.save(); this.renderAll(); if (document.getElementById('view-explorer').classList.contains('active')) this.renderExplorer();
        }
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => { app = new DocuFlowApp(); });
