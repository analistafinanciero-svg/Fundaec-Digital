class DocuFlowApp {
    constructor() {
        // Cambiamos la clave para RESETEAR y corregir errores de versiones previas
        this.STORAGE_KEY = 'docuflow_v3_stable';
        this.THIRD_PARTIES_KEY = 'fundaec_terceros';
        this.explorerState = { year: null, month: null, filterCatId: null };
        this.currentMoveDocId = null;

        // Recuperar terceros desde su propia clave de localStorage
        const savedTP = localStorage.getItem(this.THIRD_PARTIES_KEY);
        this.thirdParties = savedTP ? JSON.parse(savedTP) : [];

        // Recuperar sesión desde sessionStorage (Seguridad de Sesión)
        const session = sessionStorage.getItem('docuflow_session');
        this.currentUser = session ? JSON.parse(session) : null;

        this.loadData();
        this._lastSave = JSON.stringify(this.data);
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
                    if (!this.data.financialDocuments) this.data.financialDocuments = [];
                    if (!this.data.users) {
                        this.data.users = [{ id: 1, name: 'Admin Principal', username: 'admin', password: '1234', role: 'Administrador', status: 'Activo' }];
                    } else {
                        // Asegurar que el admin tenga credenciales si es una versión vieja
                        if (this.data.users[0] && !this.data.users[0].username) {
                            this.data.users[0].username = 'admin';
                            this.data.users[0].password = '1234';
                        }
                    }
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
                { id: 1, name: 'Admin Principal', username: 'admin', password: '1234', role: 'Administrador', status: 'Activo' }
            ],
            auditLogs: [],
            financialDocuments: []
        };
        this.saveToLocalStorage();
    }

    saveToLocalStorage() {
        const dataStr = JSON.stringify(this.data);
        // Optimización: Solo guardar si hay cambios reales comparado con el string previo
        if (this._lastSave === dataStr) return;
        localStorage.setItem(this.STORAGE_KEY, dataStr);
        this._lastSave = dataStr;
    }

    init() {
        // Registro de manejadores con protección contra elementos nulos
        this.setupNavigation();
        this.setupConfigHandlers();
        this.setupUploadLogic();
        this.setupNotifications();
        this.setupSearch();
        this.setupUserHandlers();
        this.setupLoginLogic();
        this.setupMisc();
        this.setupBackupHandlers();
        this.setupKeyboardShortcuts();
        this.setupNewModulesHandlers();

        // Si hay sesión iniciada, mostrar app
        if (this.currentUser) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'grid';
            this.updateProfileUI();
            this.updateVisibilityByRole();
        }

        // Renderizado inicial forzado
        this.renderAll();
    }

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.onclick = () => {
                const viewId = item.getAttribute('data-view');
                // Reseteo de Ruta para el Explorador
                if (viewId === 'explorer') {
                    this.resetExplorer();
                }
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
            if (viewId === 'financials') this.renderFinancials();
            if (viewId === 'thirdparties') this.renderThirdParties();
        }
    }

    renderAll() {
        this.renderCategorySelectors();
        this.renderConfigLists();
        this.renderDashboard();
        this.updateStats();
        this.renderAuditLogs();
        this.renderUsers();
        this.renderFinancials();
        this.renderThirdParties();
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

                if (!this.checkPermission('Contador')) return;
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

                // Validación de Consecutivo (Saltos)
                if (cons > cat.nextConsecutive) {
                    if (!confirm(`⚠️ El consecutivo #${cons} rompe la secuencia esperada (siguiente: ${cat.nextConsecutive}). ¿Deseas continuar?`)) {
                        if (loader) loader.style.display = 'none';
                        return;
                    }
                }

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
                            uploadedBy: this.currentUser ? this.currentUser.name : 'Sistema',
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
                                this.addNotification(`Lote #${cons} archivado correctamente`, 'success', 'Carga');
                                document.getElementById('upload-modal').style.display = 'none';
                                form.reset();
                                const label = document.getElementById('file-count-label');
                                if (label) label.textContent = 'Seleccionar PDFs';
                                this.saveToLocalStorage();
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

    addNotification(text, type, actionLabel = 'Evento') {
        const list = document.getElementById('notification-list');
        const dot = document.getElementById('notification-dot');
        const bell = document.getElementById('bell-icon');
        if (!list) return;
        if (list.querySelector('p')) list.innerHTML = '';

        const item = document.createElement('div');
        item.className = 'notification-item';
        item.style.borderLeft = `4px solid ${type === 'success' ? '#10b981' : (type === 'error' ? '#f43f5e' : '#f59e0b')}`;
        item.innerHTML = `<strong>${text}</strong><br><small>${new Date().toLocaleTimeString()}</small>`;
        list.prepend(item);

        if (dot) dot.style.display = 'block';
        if (bell) {
            bell.classList.add('bell-wiggle');
            setTimeout(() => bell.classList.remove('bell-wiggle'), 600);
        }

        const userLabel = this.currentUser ? this.currentUser.name : 'Sistema';
        const userRole = this.currentUser ? this.currentUser.role : 'Sistema';
        // Registrar en el log de auditoría
        this.data.auditLogs.push({
            time: new Date().toLocaleString(),
            action: actionLabel,
            details: `[${userRole}] ${userLabel}: ${text}`
        });
        this.saveToLocalStorage();
        this.renderAuditLogs();
        this.showToast(text, type);
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : '⚠️');

        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);

        // Auto remoción con animación
        setTimeout(() => {
            toast.style.animation = 'toastSlideOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
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
        const headerSearch = document.getElementById('global-search');
        const headerClear = document.getElementById('clear-search');
        const dashSearch = document.getElementById('dashboard-search');
        const dashClear = document.getElementById('dashboard-clear-search');

        const handleInput = (e, otherInput, otherClear) => {
            const q = e.target.value.toLowerCase().trim();
            if (otherInput) otherInput.value = e.target.value;

            const clearBtns = [headerClear, dashClear];
            clearBtns.forEach(btn => { if (btn) btn.style.display = q.length > 0 ? 'block' : 'none'; });

            if (q.length > 0) {
                this.performGlobalSearch(q);
            } else {
                this.clearSearch();
            }
        };

        if (headerSearch) headerSearch.oninput = (e) => handleInput(e, dashSearch, dashClear);
        if (dashSearch) dashSearch.oninput = (e) => handleInput(e, headerSearch, headerClear);

        if (headerClear) headerClear.onclick = () => this.clearSearch();
        if (dashClear) dashClear.onclick = () => this.clearSearch();
    }

    performGlobalSearch(query) {
        const dashSearch = document.getElementById('dashboard-search');
        const headerSearch = document.getElementById('global-search');
        const isFromDash = document.activeElement === dashSearch;

        // Cambiar a vista de búsqueda si no estamos en ella
        const currentActive = document.querySelector('.view-container.active');
        if (!currentActive || currentActive.id !== 'view-search') {
            this.switchView('search');

            // Si venía del dashboard, transferimos el foco al header
            // Esto es crucial porque al cambiar de vista, el input del dashboard se oculta y pierde el foco
            if (isFromDash && headerSearch) {
                headerSearch.focus();
                const val = headerSearch.value;
                headerSearch.value = ''; // Truco para mover cursor al final
                headerSearch.value = val;
            }
        }

        const grid = document.getElementById('search-results-grid');
        if (grid) grid.innerHTML = '<div style="text-align:center; padding:2rem; opacity:0.5;">Buscando...</div>';

        // Pequeño timeout para no bloquear el hilo principal en búsquedas masivas
        setTimeout(() => {
            const filtered = this.data.documents.filter(doc => {
                const cat = this.data.categories.find(c => c.id == doc.catId);
                const catName = cat ? cat.name.toLowerCase() : "";
                const fileName = doc.name.toLowerCase();
                const consecutive = doc.consecutive.toString();

                return fileName.includes(query) ||
                    consecutive.includes(query) ||
                    catName.includes(query);
            });

            // Buscar también en Terceros
            const filteredTP = this.thirdParties.filter(tp => {
                return tp.nit.toLowerCase().includes(query) || tp.name.toLowerCase().includes(query);
            });

            this.renderSearchResults(filtered, query, filteredTP);
        }, 50);
    }

    renderSearchResults(results, query, tpResults = []) {
        const grid = document.getElementById('search-results-grid');
        if (!grid) return;

        if (results.length === 0 && tpResults.length === 0) {
            grid.innerHTML = `
                <div class="storage-box" style="text-align:center; padding:3rem; opacity:0.6;">
                    <div style="font-size:3rem; margin-bottom:1rem;">🔍</div>
                    <p>No se encontraron resultados para "<strong>${query}</strong>"</p>
                </div>`;
            return;
        }

        const isAdmin = this.currentUser?.role === 'Administrador';
        const isVisualizer = this.currentUser?.role === 'Visualizador';
        const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        let html = '';

        if (tpResults.length > 0) {
            html += `
                <div class="storage-box" style="padding:1.5rem; border-left: 4px solid #10b981;">
                    <h3 style="margin-bottom:1rem; color:#10b981;">👥 Terceros Encontrados</h3>
                    <table class="file-table" style="width:100%; border-collapse:collapse; text-align:left;">
                        <thead style="background:#f8fafc;">
                            <tr style="border-bottom:2px solid #eee;">
                                <th style="padding:0.75rem;">NIT/Cédula</th>
                                <th>Nombre</th>
                                <th>Tipo</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tpResults.map(tp => `
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:0.75rem;"><strong>${tp.nit}</strong></td>
                                    <td>${tp.name}</td>
                                    <td><span class="badge-role" style="background:#eef2ff; color:#4f46e5;">${tp.type}</span></td>
                                    <td>
                                        <button onclick="app.openThirdPartyPreview(${tp.id})" title="Ver RUT" class="action-btn">📄</button>
                                        <button onclick="app.switchView('thirdparties')" title="Ir a Terceros" class="action-btn">🔗</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        if (results.length > 0) {
            html += `
            <div class="storage-box" style="padding:1.5rem;">
                <h3 style="margin-bottom:1rem;">📄 Documentos Encontrados</h3>
                <table class="file-table" style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead style="background:#f8fafc;">
                        <tr style="border-bottom:2px solid #eee;">
                            <th style="padding:1rem;">Consecutivo</th>
                            <th>Ubicación</th>
                            <th>Nombre</th>
                            <th>Subido por</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.map(doc => {
                const cat = this.data.categories.find(c => c.id == doc.catId);
                const [year, month] = doc.date.split('-');
                const location = `${year} > ${months[parseInt(month) - 1]} > ${cat ? cat.name : 'General'}`;

                return `
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:1rem;"><span style="font-weight:800; color:var(--primary);">${doc.consecutive.toString().padStart(3, '0')}</span></td>
                                    <td style="font-size:0.75rem; color:var(--text-body);">${location}</td>
                                    <td><strong>${doc.name}</strong></td>
                                    <td style="font-size:0.75rem;">${doc.uploadedBy || 'Sistema'}</td>
                                    <td>
                                        <button onclick="app.openPreview(${doc.id})" title="Ver" class="action-btn">👁️</button>
                                        ${!isVisualizer ? `<button onclick="app.openMoveCopyModal(${doc.id})" title="Mover/Copiar" class="action-btn">🔁</button>` : ''}
                                        ${isAdmin ? `<button onclick="app.deleteDocument(${doc.id})" title="Eliminar" class="action-btn btn-danger">🗑️</button>` : ''}
                                    </td>
                                </tr>
                            `;
            }).join('')}
                    </tbody>
                </table>
            </div>`;
        }

        grid.innerHTML = html;
    }

    clearSearch() {
        const headerSearch = document.getElementById('global-search');
        const headerClear = document.getElementById('clear-search');
        const dashSearch = document.getElementById('dashboard-search');
        const dashClear = document.getElementById('dashboard-clear-search');

        if (headerSearch) headerSearch.value = '';
        if (dashSearch) dashSearch.value = '';
        if (headerClear) headerClear.style.display = 'none';
        if (dashClear) dashClear.style.display = 'none';

        // Volver al explorer o dashboard
        this.switchView('explorer');
        this.renderExplorer();
    }

    setupLoginLogic() {
        const loginForm = document.getElementById('login-form');
        const loginScreen = document.getElementById('login-screen');
        const mainApp = document.getElementById('main-app');
        const btnLogout = document.getElementById('btn-logout');


        if (loginForm) {
            loginForm.onsubmit = (e) => {
                e.preventDefault();
                const uInput = document.getElementById('username').value.toLowerCase();
                const pInput = document.getElementById('password').value;
                const errorMsg = document.getElementById('login-error');

                const found = this.data.users.find(u => u.username?.toLowerCase() === uInput && u.password === pInput);

                if (found) {
                    if (found.status === 'Inactivo') {
                        return this.showToast('Tu cuenta ha sido desactivada. Contacta al administrador.', 'error');
                    }
                    this.currentUser = found;
                    sessionStorage.setItem('docuflow_session', JSON.stringify(found));
                    loginScreen.style.display = 'none';
                    mainApp.style.display = 'grid';
                    this.updateProfileUI();
                    this.updateVisibilityByRole();
                    this.addNotification(`Sesión iniciada como ${found.name}`, 'success', 'Login');
                    this.renderAll();
                } else {
                    if (errorMsg) {
                        errorMsg.style.display = 'block';
                        setTimeout(() => errorMsg.style.display = 'none', 3000);
                    }
                }
            };
        }

        if (btnLogout) {
            btnLogout.onclick = () => {
                if (confirm('¿Cerrar sesión en Fundaec Digital?')) {
                    this.currentUser = null;
                    sessionStorage.removeItem('docuflow_session');
                    mainApp.style.display = 'none';
                    loginScreen.style.display = 'flex';
                    document.getElementById('login-form').reset();
                }
            };
        }
    }

    updateProfileUI() {
        if (!this.currentUser) return;
        const initials = this.currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        // Actualizar UI Global
        const myAv = document.getElementById('my-avatar');
        const myNameInp = document.getElementById('my-profile-name');
        const myRoleLab = document.getElementById('my-profile-role');
        const headerAv = document.querySelector('.header-tools div[style*="width: 32px"]');

        if (myAv) myAv.textContent = initials;
        if (myNameInp) myNameInp.value = this.currentUser.name;
        if (myRoleLab) myRoleLab.textContent = this.currentUser.role;
        if (headerAv) headerAv.textContent = initials;
    }

    updateVisibilityByRole() {
        if (!this.currentUser) return;

        const isAdmin = this.currentUser.role === 'Administrador';
        const isVisualizer = this.currentUser.role === 'Visualizador';

        // Sidebar Sections
        const configNav = document.querySelector('.nav-item[data-view="config"]');
        const usersNav = document.querySelector('.nav-item[data-view="users"]');
        const auditNav = document.querySelector('.nav-item[data-view="audit"]');
        const reportsNav = document.querySelector('.nav-item[data-view="reports"]');

        if (configNav) configNav.style.display = isAdmin ? 'flex' : 'none';
        if (usersNav) usersNav.style.display = isAdmin ? 'flex' : 'none';
        if (auditNav) auditNav.style.display = isAdmin ? 'flex' : 'none';
        if (reportsNav) reportsNav.style.display = isVisualizer ? 'none' : 'flex';

        // Botón flotante "Add New"
        const fab = document.querySelector('.btn-fab[onclick*="upload-modal"]');
        if (fab) fab.style.display = isVisualizer ? 'none' : 'block';

        // Botones de nuevos módulos
        const btnFin = document.getElementById('btn-open-financial-modal');
        const btnTP = document.getElementById('btn-open-thirdparty-modal');
        if (btnFin) btnFin.style.display = isVisualizer ? 'none' : 'block';
        if (btnTP) btnTP.style.display = isVisualizer ? 'none' : 'block';

        // Backup Section (Config)
        const backupSec = document.getElementById('backup-section');
        if (backupSec) backupSec.style.display = isAdmin ? 'block' : 'none';
    }

    updateMyProfile() {
        const newName = document.getElementById('my-profile-name').value;
        if (!newName) return this.showToast('El nombre no puede estar vacío', 'warning');

        // Actualizar en la lista de datos
        const user = this.data.users.find(u => u.id === this.currentUser.id);
        if (user) {
            user.name = newName;
            this.currentUser.name = newName;
            sessionStorage.setItem('docuflow_session', JSON.stringify(this.currentUser));
            this.saveToLocalStorage();
            this.updateProfileUI();
            this.renderUsers();
            this.addNotification('Perfil actualizado correctamente', 'success', 'Perfil');
        }
    }

    // RBAC: Helper de permisos
    checkPermission(requiredRole = 'Administrador') {
        if (!this.currentUser) return false;

        const roles = {
            'Administrador': 3,
            'Contador': 2,
            'Visualizador': 1
        };

        const hasPermission = roles[this.currentUser.role] >= roles[requiredRole];

        if (!hasPermission) {
            this.showToast(`No tienes permisos de ${requiredRole} para esta acción`, 'error');
        }

        return hasPermission;
    }

    setupUserHandlers() {
        const form = document.getElementById('user-form');
        const btnOpen = document.getElementById('btn-open-user-modal');

        if (btnOpen) {
            btnOpen.onclick = () => {
                if (!this.checkPermission('Administrador')) return;
                document.getElementById('user-modal-title').textContent = 'Nuevo Usuario';
                document.getElementById('edit-user-id').value = '';
                document.getElementById('status-field-container').style.display = 'none';
                document.getElementById('password-field-container').style.display = 'block';
                document.getElementById('user-pass').placeholder = '';
                document.getElementById('user-pass').required = true;
                document.getElementById('user-submit-btn').textContent = 'Crear Usuario';
                form.reset();
                document.getElementById('user-modal').style.display = 'flex';
            };
        }

        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                const userId = document.getElementById('edit-user-id').value;
                const name = document.getElementById('user-name').value;
                const username = document.getElementById('user-login').value;
                const password = document.getElementById('user-pass').value;
                const role = document.getElementById('user-role').value;
                const status = document.getElementById('user-status').value;

                if (userId) {
                    // MODO EDICIÓN
                    const user = this.data.users.find(u => u.id == userId);

                    // SEGURIDAD: Protección del último administrador
                    if (user.role === 'Administrador' && (role !== 'Administrador' || status === 'Inactivo')) {
                        const activeAdmins = this.data.users.filter(u => u.role === 'Administrador' && u.status === 'Activo');
                        if (activeAdmins.length === 1 && activeAdmins[0].id == userId) {
                            return alert('CRÍTICO: No puedes desactivar o degradar al último Administrador activo.');
                        }
                    }

                    user.name = name;
                    user.username = username;
                    user.role = role;
                    user.status = status;
                    if (password) user.password = password;

                    // Sincronizar sesión si es el usuario actual
                    if (this.currentUser.id == userId) {
                        this.currentUser = { ...user };
                        sessionStorage.setItem('docuflow_session', JSON.stringify(this.currentUser));
                        this.updateProfileUI();
                        this.updateVisibilityByRole();
                    }

                    this.addNotification(`Usuario ${name} actualizado`, 'success', 'Seguridad');
                } else {
                    // MODO CREACIÓN
                    this.data.users.push({
                        id: Date.now(),
                        name: name,
                        username: username,
                        password: password,
                        role: role,
                        status: 'Activo'
                    });
                    this.addNotification(`Usuario ${name} creado con éxito`, 'success', 'Seguridad');
                }

                this.saveToLocalStorage();
                this.renderUsers();
                document.getElementById('user-modal').style.display = 'none';
                form.reset();
            };
        }
    }

    openEditUserModal(id) {
        if (!this.checkPermission('Administrador')) return;
        const user = this.data.users.find(u => u.id == id);
        if (!user) return;

        document.getElementById('user-modal-title').textContent = 'Editar Usuario';
        document.getElementById('edit-user-id').value = user.id;
        document.getElementById('user-name').value = user.name;
        document.getElementById('user-login').value = user.username;
        document.getElementById('user-pass').value = ''; // No mostrar password
        document.getElementById('user-role').value = user.role;
        document.getElementById('user-status').value = user.status;

        document.getElementById('status-field-container').style.display = 'block';
        document.getElementById('password-field-container').style.display = 'block';
        document.getElementById('user-pass').placeholder = 'Dejar en blanco para no cambiar';
        document.getElementById('user-pass').required = false;
        document.getElementById('user-submit-btn').textContent = 'Guardar Cambios';

        document.getElementById('user-modal').style.display = 'flex';
    }

    renderUsers() {
        const body = document.getElementById('users-table-body');
        if (!body) return;

        body.innerHTML = this.data.users.map(user => {
            const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            const isSelf = this.currentUser && this.currentUser.id === user.id;

            return `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:1rem;">
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <div class="user-avatar-md">${initials}</div>
                            <div>
                                <strong>${user.name} ${isSelf ? '<small>(Tú)</small>' : ''}</strong><br>
                                <span style="font-size:0.75rem; color:var(--text-body);">@${user.username}</span>
                            </div>
                        </div>
                    </td>
                    <td><span class="badge-role">${user.role}</span></td>
                    <td><span class="badge-status ${user.status === 'Activo' ? 'active' : 'inactive'}">● ${user.status}</span></td>
                    <td>
                        <div style="display:flex; gap:0.5rem;">
                            <button onclick="app.openEditUserModal(${user.id})" class="action-btn" title="Editar">✏️</button>
                            ${user.id !== 1 && !isSelf ? `
                                <button onclick="app.toggleUserStatus(${user.id})" class="action-btn" title="${user.status === 'Activo' ? 'Desactivar' : 'Activar'}">
                                    ${user.status === 'Activo' ? '🚫' : '✅'}
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    toggleUserStatus(id) {
        if (!this.checkPermission('Administrador')) return;
        const user = this.data.users.find(u => u.id == id);
        if (!user) return;

        // Protección último Admin
        if (user.role === 'Administrador' && user.status === 'Activo') {
            const activeAdmins = this.data.users.filter(u => u.role === 'Administrador' && u.status === 'Activo');
            if (activeAdmins.length === 1) {
                return alert('No puedes desactivar al único Administrador activo del sistema.');
            }
        }

        user.status = user.status === 'Activo' ? 'Inactivo' : 'Activo';
        this.saveToLocalStorage();
        this.renderUsers();
        this.addNotification(`Usuario ${user.name} marcado como ${user.status}`, 'warning', 'Seguridad');
    }

    deleteUser(id) {
        // Obsoleto en favor de toggleUserStatus
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
        // Ordenar por consecutivo
        docs.sort((a, b) => parseInt(a.consecutive) - parseInt(b.consecutive));

        const isVisualizer = this.currentUser?.role === 'Visualizador';
        const isContador = this.currentUser?.role === 'Contador';
        const isAdmin = this.currentUser?.role === 'Administrador';

        let html = bcHtml + `
            <div style="grid-column:1/-1; display:flex; justify-content:flex-end; margin-bottom:1rem;">
                ${!isVisualizer ? `<button onclick="app.exportExplorerToExcel()" class="btn-fab" style="position:static; background:var(--success); font-size:0.85rem; padding:0.6rem 1.2rem;">📊 Generar Reporte Excel</button>` : ''}
            </div>
            <div style="grid-column:1/-1; background:white; padding:1.5rem; border-radius:var(--radius-md); box-shadow:var(--shadow);">
                <table class="file-table" style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead style="background:#f8fafc;">
                        <tr style="border-bottom:2px solid #eee;">
                            <th style="padding:1rem;">Consecutivo</th>
                            <th>Tipo</th>
                            <th>Nombre</th>
                            <th>Fecha</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${docs.map(doc => `
                            <tr style="border-bottom:1px solid #f1f5f9;">
                                <td style="padding:1rem;"><span style="font-weight:800; color:var(--primary); font-size:1rem;">${doc.consecutive.toString().padStart(3, '0')}</span></td>
                                <td style="font-size:1.5rem;">${this.getFileTypeIcon(doc.name)}</td>
                                <td><strong>${doc.name}</strong></td>
                                <td style="font-size:0.85rem;">${doc.date}</td>
                                <td>
                                    <button onclick="app.openPreview(${doc.id})" title="Ver" class="action-btn">👁️</button>
                                    ${!isVisualizer ? `<button onclick="app.openMoveCopyModal(${doc.id})" title="Mover/Copiar" class="action-btn">🔁</button>` : ''}
                                    ${isAdmin ? `<button onclick="app.deleteDocument(${doc.id})" title="Eliminar" class="action-btn btn-danger">🗑️</button>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
        grid.innerHTML = html;
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Tecla ESC para cerrar modales
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay').forEach(modal => {
                    if (modal.id === 'loader-overlay') return; // No cerrar el cargador
                    modal.style.display = 'none';
                });
                this.closePreview();
            }

            // Tecla ENTER para acciones principales
            if (e.key === 'Enter') {
                const activeModal = Array.from(document.querySelectorAll('.modal-overlay')).find(m => m.style.display === 'flex');

                if (document.getElementById('login-screen').style.display !== 'none') {
                    // Si estamos en login, el submit del form ya lo maneja, no necesitamos hacer nada extra
                    return;
                }

                if (activeModal) {
                    const primaryBtn = activeModal.querySelector('button[type="submit"], button.btn-fab:not([style*="background:#6b7280"])');
                    if (primaryBtn) {
                        e.preventDefault();
                        primaryBtn.click();
                    }
                }
            }
        });
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

        // Exportación de reportes real
        const btnRep = document.getElementById('btn-export-excel');
        if (btnRep) {
            btnRep.onclick = () => {
                if (!this.checkPermission('Contador')) return;
                this.exportMonthlyReport();
            };
        }
    }

    setupBackupHandlers() {
        const btnDown = document.getElementById('btn-download-backup');
        const inputRest = document.getElementById('input-restore-backup');

        if (btnDown) {
            btnDown.onclick = () => {
                if (!this.checkPermission('Administrador')) return;
                this.exportBackup();
            };
        }

        if (inputRest) {
            inputRest.onchange = (e) => {
                if (!this.checkPermission('Administrador')) return;
                const file = e.target.files[0];
                if (file) this.restoreBackup(file);
                inputRest.value = ''; // Reset
            };
        }
    }

    exportBackup() {
        const now = new Date();
        const dateStr = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
        const fileName = `Backup_Fundaec_${dateStr}.json`;

        // Crear JSON
        const dataStr = JSON.stringify(this.data, null, 4);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        // Link temporal para descarga
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.addNotification(`Generó un Backup General del sistema`, 'success', 'Seguridad');
    }

    restoreBackup(file) {
        if (!confirm('⚠️ ATENCIÓN: Al restaurar este backup, se borrarán todos los datos actuales (configuración, archivos, usuarios y registros) y se reemplazarán por los del archivo.\n\n¿Desea continuar?')) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);

                // Validación básica de estructura
                const keys = ['categories', 'types', 'documents', 'users', 'auditLogs'];
                const isValid = keys.every(k => Array.isArray(importedData[k]));

                if (!isValid) {
                    return this.showToast('Error: El archivo no tiene el formato válido de FUNDAEC.', 'error');
                }

                // Aplicar Cambios
                this.data = importedData;
                this.saveToLocalStorage();

                this.addNotification(`Restauró un Backup General del sistema`, 'warning', 'Seguridad');

                alert('📦 Restauración exitosa. La aplicación se recargará para aplicar los cambios.');
                location.reload();

            } catch (err) {
                console.error(err);
                this.showToast('Error al leer el archivo de backup.', 'error');
            }
        };
        reader.readAsText(file);
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
                if (!this.checkPermission('Administrador')) return;
                const nameInp = document.getElementById('new-cat-name');
                if (!nameInp.value) return;
                this.data.categories.push({
                    id: Date.now(),
                    name: nameInp.value,
                    icon: '📂',
                    nextConsecutive: 1,
                    color: '#4f46e5'
                });
                this.saveToLocalStorage();
                this.renderAll();
                nameInp.value = '';
            };
        }

        if (btnType) {
            btnType.onclick = () => {
                if (!this.checkPermission('Administrador')) return;
                const catId = configSelCat.value;
                const nameInp = document.getElementById('new-type-name');
                if (!catId || !nameInp.value) return alert('Selecciona categoría y nombre');
                this.data.types.push({
                    id: Date.now(),
                    catId: parseInt(catId),
                    name: nameInp.value
                });
                this.saveToLocalStorage();
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
        if (!this.checkPermission('Administrador')) return;
        if (confirm('¿Eliminar categoría? Se perderán los tipos pero no los documentos.')) {
            this.data.categories = this.data.categories.filter(c => c.id != id);
            this.saveToLocalStorage();
            this.renderAll();
        }
    }

    deleteType(id) {
        if (!this.checkPermission('Administrador')) return;
        this.data.types = this.data.types.filter(t => t.id != id);
        this.saveToLocalStorage();
        this.renderAll();
    }

    openMoveCopyModal(id) {
        if (!this.checkPermission('Contador')) return;
        const doc = this.data.documents.find(d => d.id == id);
        if (!doc) return;
        this.currentMoveDocId = id;
        document.getElementById('move-title').innerText = `Acciones para: ${doc.name}`;

        // Pre-cargar valores actuales
        const [year, month] = doc.date.split('-');
        document.getElementById('move-consecutive').value = doc.consecutive || '';
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
        const newConsecutive = parseInt(document.getElementById('move-consecutive').value);

        if (!newYear || !newMonthNum || !newCatId || isNaN(newConsecutive)) {
            return this.showToast('Completa todos los campos de destino.', 'error');
        }

        const destinyCat = this.data.categories.find(c => c.id == newCatId);
        if (!destinyCat) return this.showToast('Categoría destino no válida.', 'error');

        // Validación de Saltos de Consecutivo
        if (newConsecutive > destinyCat.nextConsecutive) {
            if (!confirm(`⚠️ El consecutivo #${newConsecutive} rompe la secuencia en ${destinyCat.name} (siguiente esperado: ${destinyCat.nextConsecutive}). ¿Continuar?`)) return;
        }

        // Mostrar Loader Overlay Informativo
        const loader = document.getElementById('loader-overlay');
        const loaderTitle = document.getElementById('loader-title');
        const loaderSubtitle = document.getElementById('loader-subtitle');
        if (loader) {
            loaderTitle.textContent = action === 'copy' ? 'Copiando documento...' : 'Trasladando documento...';
            loaderSubtitle.textContent = `Ajustando registros para: ${doc.name}`;
            loader.style.display = 'flex';
        }

        setTimeout(() => {
            const newDate = `${newYear}-${newMonthNum.toString().padStart(2, '0')}-01`;
            const actionLabel = action === 'copy' ? 'Copiado' : 'Movido';

            if (action === 'copy') {
                const newCopy = {
                    ...doc,
                    id: Date.now(),
                    date: newDate,
                    catId: parseInt(newCatId),
                    consecutive: newConsecutive,
                    timestamp: new Date().toLocaleString()
                };
                this.data.documents.push(newCopy);
            } else {
                // Registro detallado para auditoría antes de mover
                const oldLoc = `Cat ID ${doc.catId} - ${doc.date}`;
                doc.date = newDate;
                doc.catId = parseInt(newCatId);
                doc.consecutive = newConsecutive;
            }

            // Actualizar nextConsecutive de la categoría si es mayor
            if (newConsecutive >= destinyCat.nextConsecutive) {
                destinyCat.nextConsecutive = newConsecutive + 1;
            }

            this.saveToLocalStorage();
            const finalMsg = action === 'copy' ? `Doc. #${newConsecutive} copiado con éxito` : `Doc. #${newConsecutive} movido con éxito`;
            this.addNotification(finalMsg, 'success', actionLabel);

            if (loader) loader.style.display = 'none';
            this.renderAll();
            if (document.getElementById('view-explorer').classList.contains('active')) this.renderExplorer();
            document.getElementById('move-modal').style.display = 'none';
            this.currentMoveDocId = null;
        }, 800);
    }

    deleteDocument(id) {
        if (!this.checkPermission('Administrador')) return;
        const doc = this.data.documents.find(d => d.id == id);
        if (!doc) return;

        if (confirm(`¿Estás seguro de eliminar el archivo "${doc.name}"? Esta acción quedará registrada en la auditoría.`)) {
            const cat = this.data.categories.find(c => c.id == doc.catId);
            const [year, month] = doc.date.split('-');
            const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            const monthName = months[parseInt(month) - 1] || month;

            // Preparar detalle de auditoría
            const auditDetail = `Eliminación: [${doc.consecutive}] ${doc.name}. Ubicación original: ${year} > ${monthName} > ${cat?.name || 'Sin Cat'}.`;

            // Registrar en auditoría
            this.addNotification(auditDetail, 'error', 'Eliminación');

            // Eliminar archivo
            this.data.documents = this.data.documents.filter(d => d.id != id);
            this.saveToLocalStorage();
            this.renderAll();
            if (document.getElementById('view-explorer').classList.contains('active')) this.renderExplorer();
        }
    }

    // New method for exporting explorer data to Excel
    exportExplorerToExcel() {
        if (!this.checkPermission('Contador')) return;

        if (typeof XLSX === 'undefined') {
            return this.showToast('Error: Librería Excel no cargada. Verifica tu conexión a internet.', 'error');
        }

        try {
            const year = this.explorerState.year;
            const monthFilter = (this.explorerState.month || "").toString().padStart(2, '0');
            const catId = this.explorerState.filterCatId;
            const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            const monthName = months[parseInt(this.explorerState.month) - 1] || "Reporte";

            // Filtrar documentos de la vista actual
            let docs = this.data.documents.filter(d => d.date.startsWith(`${year}-${monthFilter}`) && d.catId == catId);
            docs.sort((a, b) => parseInt(a.consecutive) - parseInt(b.consecutive));

            if (docs.length === 0) {
                return this.showToast('No hay documentos en esta carpeta para exportar.', 'warning');
            }

            const catName = this.data.categories.find(c => c.id == catId)?.name || 'General';

            // Preparar datos para Excel
            const excelData = docs.map(doc => ({
                "Consecutivo": doc.consecutive.toString().padStart(3, '0'),
                "Nombre del Archivo": doc.name,
                "Categoría": catName,
                "Fecha de Subida": doc.timestamp,
                "Usuario": doc.uploadedBy || "Sistema"
            }));

            // Crear Libro y Hoja
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);

            // Formato básico: Ajustar anchos de columna
            const wscols = [
                { wch: 15 }, // Consecutivo
                { wch: 40 }, // Nombre
                { wch: 20 }, // Categoría
                { wch: 25 }, // Fecha
                { wch: 20 }  // Usuario
            ];
            ws['!cols'] = wscols;

            XLSX.utils.book_append_sheet(wb, ws, "Documentos");

            // Nombre del archivo sanitizado
            const fileName = `Reporte_Fundaec_${catName}_${monthName}_${year}.xlsx`
                .replace(/[/\\?%*:|"<>]/g, '-')
                .replace(/\s+/g, '_');

            // Descargar
            XLSX.writeFile(wb, fileName);

            // Auditoría
            this.addNotification(`Generó reporte Excel de la carpeta: ${catName} (${monthName} ${year})`, 'success', 'Reporte');
        } catch (error) {
            console.error('Error generando Excel:', error);
            this.showToast('Error inesperado al generar el archivo. Intenta de nuevo.', 'error');
        }
    }

    // --- NEW MODULES: Financials & Third Parties ---

    setupNewModulesHandlers() {
        // Financials
        const btnOpenFin = document.getElementById('btn-open-financial-modal');
        const formFin = document.getElementById('financial-upload-form');

        if (btnOpenFin) {
            btnOpenFin.onclick = () => {
                if (!this.checkPermission('Contador')) return;
                document.getElementById('financial-modal').style.display = 'flex';
            };
        }

        if (formFin) {
            formFin.onsubmit = async (e) => {
                e.preventDefault();
                await this.saveFinancial();
            };
        }

        // Third Parties
        const btnOpenTP = document.getElementById('btn-open-thirdparty-modal');
        const formTP = document.getElementById('thirdparty-form');

        if (btnOpenTP) {
            btnOpenTP.onclick = () => {
                if (!this.checkPermission('Contador')) return;
                document.getElementById('thirdparty-modal-title').textContent = 'Añadir Tercero';
                document.getElementById('edit-thirdparty-id').value = '';
                document.getElementById('tp-file-help').style.display = 'none';
                formTP.reset();
                document.getElementById('thirdparty-modal').style.display = 'flex';
            };
        }

        if (formTP) {
            formTP.onsubmit = async (e) => {
                e.preventDefault();
                await this.saveThirdParty();
            };
        }
    }

    async saveFinancial() {
        const year = document.getElementById('fin-year').value;
        const name = document.getElementById('fin-name').value;
        const fileInp = document.getElementById('fin-file');

        if (!year || !name || !fileInp.files[0]) return alert('Completa todos los campos');

        const file = fileInp.files[0];
        const reader = new FileReader();

        reader.onload = (ev) => {
            const newDoc = {
                id: Date.now(),
                year: year,
                name: name,
                uploadedBy: this.currentUser?.name || 'Sistema',
                timestamp: new Date().toLocaleString(),
                content: ev.target.result
            };

            this.data.financialDocuments.push(newDoc);
            this.saveToLocalStorage();
            this.renderFinancials();

            this.addNotification(`Subió estado financiero: ${name} (${year})`, 'success', 'Contabilidad');
            document.getElementById('financial-modal').style.display = 'none';
            document.getElementById('financial-upload-form').reset();
        };

        reader.readAsDataURL(file);
    }

    renderFinancials() {
        const body = document.getElementById('financials-table-body');
        if (!body) return;

        const docs = this.data.financialDocuments || [];
        docs.sort((a, b) => b.year - a.year);

        const isAdmin = this.currentUser?.role === 'Administrador';

        body.innerHTML = docs.length > 0
            ? docs.map(doc => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:1rem;"><strong>${doc.year}</strong></td>
                    <td>${doc.name}</td>
                    <td style="font-size:0.8rem;">${doc.timestamp}</td>
                    <td style="font-size:0.8rem;">${doc.uploadedBy}</td>
                    <td>
                        <button onclick="app.openFinancialPreview(${doc.id})" class="action-btn" title="Ver">👁️</button>
                        ${isAdmin ? `<button onclick="app.deleteFinancial(${doc.id})" class="action-btn btn-danger" title="Eliminar">🗑️</button>` : ''}
                    </td>
                </tr>
            `).join('')
            : '<tr><td colspan="5" style="text-align:center; padding:2rem; opacity:0.5;">No hay estados financieros registrados</td></tr>';
    }

    openFinancialPreview(id) {
        const doc = this.data.financialDocuments.find(d => d.id == id);
        if (!doc) return;
        document.getElementById('pdf-modal').style.display = 'flex';
        document.getElementById('pdf-preview-frame').src = doc.content;
    }

    deleteFinancial(id) {
        if (!this.checkPermission('Administrador')) return;
        if (confirm('¿Seguro que deseas eliminar este estado financiero?')) {
            const doc = this.data.financialDocuments.find(d => d.id == id);
            this.data.financialDocuments = this.data.financialDocuments.filter(d => d.id != id);
            this.saveToLocalStorage();
            this.renderFinancials();
            this.addNotification(`Eliminó estado financiero: ${doc?.name}`, 'error', 'Contabilidad');
        }
    }

    async saveThirdParty() {
        const id = document.getElementById('edit-thirdparty-id').value;
        const nit = document.getElementById('tp-nit').value;
        const name = document.getElementById('tp-name').value;
        const type = document.getElementById('tp-type').value;
        const fileInp = document.getElementById('tp-file');

        let fileContent = null;
        if (fileInp.files[0]) {
            fileContent = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(fileInp.files[0]);
            });
        }

        if (id) {
            // Edit
            const tp = this.thirdParties.find(t => t.id == id);
            if (tp) {
                tp.nit = nit;
                tp.name = name;
                tp.type = type;
                if (fileContent) tp.content = fileContent;
                this.addNotification(`Actualizó tercero: ${name}`, 'success', 'Terceros');
            }
        } else {
            // New
            if (!fileContent) return alert('Debes subir el RUT del tercero');
            const newTP = {
                id: Date.now(),
                nit: nit,
                name: name,
                type: type,
                content: fileContent,
                uploadedBy: this.currentUser?.name || 'Sistema',
                timestamp: new Date().toLocaleString()
            };
            this.thirdParties.push(newTP);
            this.addNotification(`Añadió nuevo tercero: ${name}`, 'success', 'Terceros');
        }

        localStorage.setItem(this.THIRD_PARTIES_KEY, JSON.stringify(this.thirdParties));
        this.renderThirdParties();
        document.getElementById('thirdparty-modal').style.display = 'none';
        document.getElementById('thirdparty-form').reset();
    }

    renderThirdParties() {
        const body = document.getElementById('thirdparties-table-body');
        if (!body) return;

        const isAdmin = this.currentUser?.role === 'Administrador';

        body.innerHTML = this.thirdParties.length > 0
            ? this.thirdParties.map(tp => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:1rem;"><strong>${tp.nit}</strong></td>
                    <td>${tp.name}</td>
                    <td><span class="badge-role" style="background:#eef2ff; color:#4f46e5;">${tp.type}</span></td>
                    <td>
                        <button onclick="app.openThirdPartyPreview(${tp.id})" class="action-btn" title="Ver RUT">📄 Ver RUT</button>
                    </td>
                    <td>
                        <div style="display:flex; gap:0.5rem;">
                            <button onclick="app.openEditThirdPartyModal(${tp.id})" class="action-btn" title="Editar">✏️</button>
                            ${isAdmin ? `<button onclick="app.deleteThirdParty(${tp.id})" class="action-btn btn-danger" title="Eliminar">🗑️</button>` : ''}
                        </div>
                    </td>
                </tr>
            `).join('')
            : '<tr><td colspan="5" style="text-align:center; padding:2rem; opacity:0.5;">No hay terceros registrados</td></tr>';
    }

    openThirdPartyPreview(id) {
        const tp = this.thirdParties.find(t => t.id == id);
        if (!tp) return;
        document.getElementById('pdf-modal').style.display = 'flex';
        document.getElementById('pdf-preview-frame').src = tp.content;
    }

    openEditThirdPartyModal(id) {
        if (!this.checkPermission('Contador')) return;
        const tp = this.thirdParties.find(t => t.id == id);
        if (!tp) return;

        document.getElementById('thirdparty-modal-title').textContent = 'Editar Tercero';
        document.getElementById('edit-thirdparty-id').value = tp.id;
        document.getElementById('tp-nit').value = tp.nit;
        document.getElementById('tp-name').value = tp.name;
        document.getElementById('tp-type').value = tp.type;
        document.getElementById('tp-file-help').style.display = 'block';

        document.getElementById('thirdparty-modal').style.display = 'flex';
    }

    deleteThirdParty(id) {
        if (!this.checkPermission('Administrador')) return;
        if (confirm('¿Seguro que deseas eliminar este tercero de la base de datos?')) {
            const tp = this.thirdParties.find(t => t.id == id);
            this.thirdParties = this.thirdParties.filter(t => t.id != id);
            localStorage.setItem(this.THIRD_PARTIES_KEY, JSON.stringify(this.thirdParties));
            this.renderThirdParties();
            this.addNotification(`Eliminó tercero: ${tp?.name}`, 'error', 'Terceros');
        }
    }

    // --- EXISTING METHODS ---

    exportMonthlyReport() {
        if (typeof XLSX === 'undefined') {
            return this.showToast('Error: Librería Excel no cargada. Verifica tu conexión a internet.', 'error');
        }

        const dateVal = document.getElementById('report-month-filter').value;
        if (!dateVal) return this.showToast('Selecciona un mes para el reporte.', 'warning');

        // Filtrar documentos del mes/año seleccionado
        const docs = this.data.documents.filter(d => d.date.startsWith(dateVal));
        if (docs.length === 0) return this.showToast('No hay documentos para el mes seleccionado.', 'warning');

        // Ordenar: Primero por categoría, luego por consecutivo
        docs.sort((a, b) => {
            if (a.catId != b.catId) return a.catId - b.catId;
            return a.consecutive - b.consecutive;
        });

        try {
            const excelData = docs.map(doc => {
                const cat = this.data.categories.find(c => c.id == doc.catId);
                return {
                    "Año-Mes": dateVal,
                    "Consecutivo": doc.consecutive.toString().padStart(3, '0'),
                    "Categoría": cat ? cat.name : 'Varios',
                    "Nombre del Archivo": doc.name,
                    "Fecha Registro": doc.timestamp,
                    "Cargado Por": doc.uploadedBy || "Sistema"
                };
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);

            // Ajustar columnas
            ws['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 25 }, { wch: 20 }];

            XLSX.utils.book_append_sheet(wb, ws, "Reporte Mensual");
            XLSX.writeFile(wb, `Reporte_Mensual_Fundaec_${dateVal}.xlsx`);

            this.addNotification(`Generó reporte mensual consolidado de: ${dateVal}`, 'success', 'Reporte');
        } catch (error) {
            console.error(error);
            this.showToast('Error al generar reporte mensual.', 'error');
        }
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => { app = new DocuFlowApp(); });
