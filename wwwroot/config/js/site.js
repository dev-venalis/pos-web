const SETTINGS_API = '/api/settings';
const SETTINGS_ENDPOINTS = Object.freeze({
  testConnection: `${SETTINGS_API}/test-connection`,
  folders: `${SETTINGS_API}/folders`,
  ticketImage: `${SETTINGS_API}/ticket-image`
});

let origenes = [];
let carpetaActual = '';
let sesionActiva = false;
let imagenTicketSeleccionada = null;
let imagenTicketPreviewUrl = '';

function elemento(id) {
  return document.getElementById(id);
}

function mostrar(texto, ok) {
  const id = sesionActiva ? 'msg' : 'authMsg';
  const msg = elemento(id);
  msg.textContent = texto;
  msg.className = `msg ${ok ? 'ok' : 'err'}`;
  msg.style.display = 'block';
}

function mostrarContenido(visible) {
  elemento('configContent').hidden = !visible;
}

async function leerRespuesta(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin'
  });
  const payload = await leerRespuesta(response);

  if (!response.ok) {
    throw new Error(
      payload.message || 'No fue posible autenticar la configuración.'
    );
  }

  return payload;
}

function liberarPrevisualizacionImagen() {
  if (imagenTicketPreviewUrl) {
    URL.revokeObjectURL(imagenTicketPreviewUrl);
    imagenTicketPreviewUrl = '';
  }
}

function mostrarImagenTicket(url) {
  const preview = elemento('ticketImagePreview');
  const empty = elemento('ticketImageEmpty');
  liberarPrevisualizacionImagen();

  if (!url) {
    preview.removeAttribute('src');
    preview.hidden = true;
    empty.hidden = false;
    return;
  }

  imagenTicketPreviewUrl = url;
  preview.src = url;
  preview.hidden = false;
  empty.hidden = true;
}

function seleccionarImagen(file) {
  imagenTicketSeleccionada = file || null;

  if (!file) {
    mostrarImagenTicket('');
    return false;
  }

  if (!file.type.startsWith('image/')) {
    imagenTicketSeleccionada = null;
    mostrarImagenTicket('');
    mostrar('Selecciona un archivo de imagen válido.', false);
    return false;
  }

  mostrarImagenTicket(URL.createObjectURL(file));
  return true;
}

function previsualizarImagen(event) {
  const file = event.target.files?.[0];
  if (!seleccionarImagen(file)) {
    event.target.value = '';
  }
}

function configurarDropZone() {
  const dropZone = elemento('ticketImageDropZone');
  const input = elemento('ticketImage');

  dropZone.addEventListener('click', () => input.click());
  dropZone.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });

  dropZone.addEventListener('dragenter', event => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  });
  dropZone.addEventListener('dragover', event => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragging');
  });
  dropZone.addEventListener('drop', event => {
    event.preventDefault();
    dropZone.classList.remove('dragging');

    const file = event.dataTransfer.files?.[0];
    if (seleccionarImagen(file)) {
      void subirImagenTicket();
    }
  });
}

async function cargarImagenTicket(configuracion) {
  if (!configuracion?.Configured) {
    mostrarImagenTicket('');
    return;
  }

  try {
    const response = await fetch(
      `${configuracion.Url}?t=${Date.now()}`,
      { credentials: 'same-origin' }
    );

    if (!response.ok) {
      throw new Error('No fue posible cargar la imagen del ticket.');
    }

    mostrarImagenTicket(URL.createObjectURL(await response.blob()));
  } catch (error) {
    mostrar(error.message, false);
  }
}

async function subirImagenTicket() {
  const btn = elemento('btnUploadTicketImage');
  if (!imagenTicketSeleccionada) {
    mostrar('Selecciona una imagen del ticket.', false);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Subiendo...';

  try {
    const formData = new FormData();
    formData.append('image', imagenTicketSeleccionada);
    const response = await request(SETTINGS_ENDPOINTS.ticketImage, {
      method: 'POST',
      body: formData
    });

    imagenTicketSeleccionada = null;
    elemento('ticketImage').value = '';
    mostrar(response.message, true);
    await cargar();
  } catch (error) {
    mostrar(error.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Subir imagen';
  }
}

async function autenticar() {
  sesionActiva = true;
  mostrarContenido(true);
  elemento('authMsg').style.display = 'none';

  await cargar();
}

function renderOrigenes() {
  const list = elemento('originList');
  list.innerHTML = '';
  origenes.forEach((url, index) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.className = 'url';
    span.textContent = url;
    const btn = document.createElement('button');
    btn.className = 'btn-danger btn-small';
    btn.textContent = 'Quitar';
    btn.onclick = () => {
      origenes.splice(index, 1);
      renderOrigenes();
    };
    li.appendChild(span);
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function agregarOrigen() {
  const input = elemento('originInput');
  const valor = input.value.trim();
  if (!valor) {
    return;
  }

  origenes.push(valor);
  input.value = '';
  renderOrigenes();
}

function obtenerConexion() {
  return {
    Server: elemento('dbServer').value.trim(),
    Database: elemento('dbDatabase').value.trim(),
    UserId: elemento('dbUser').value.trim(),
    Password: elemento('dbPassword').value
  };
}

async function probarConexion() {
  const btn = elemento('btnTestConn');
  btn.disabled = true;
  btn.textContent = 'Probando...';

  try {
    const response = await request(SETTINGS_ENDPOINTS.testConnection, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obtenerConexion())
    });
    mostrar(response.message, true);
  } catch (error) {
    mostrar(error.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Probar conexión';
  }
}

async function cargar() {
  try {
    const data = await request(SETTINGS_API);
    elemento('host').value = data.Server?.Host || '';
    elemento('port').value = data.Server?.Port || '';
    origenes = data.AllowedOriginsList || [];
    renderOrigenes();
    elemento('dbServer').value = data.ConnectionStrings?.Server || '';
    elemento('dbDatabase').value = data.ConnectionStrings?.Database || '';
    elemento('dbUser').value = data.ConnectionStrings?.UserId || '';
    elemento('dbPassword').value = '';
    elemento('dbPasswordHint').textContent = data.ConnectionStrings?.PasswordConfigured
      ? 'La contraseña actual está configurada. Déjala vacía para conservarla.'
      : 'No hay una contraseña configurada.';
    elemento('rootFolder').value = data.POS?.rootFolder || '';
    await cargarImagenTicket(data.TicketImage);
  } catch (error) {
    mostrar(error.message, false);
  }
}

async function guardar() {
  const btn = elemento('btnSave');
  btn.disabled = true;

  try {
    const connection = obtenerConexion();
    await request(SETTINGS_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Server: {
          Host: elemento('host').value.trim(),
          Port: Number.parseInt(elemento('port').value, 10) || 8080
        },
        AllowedOriginsList: origenes,
        ConnectionStrings: connection,
        POS: {
          rootFolder: elemento('rootFolder').value.trim()
        }
      })
    });
    mostrar('Configuración guardada correctamente.', true);
  } catch (error) {
    mostrar(error.message, false);
  } finally {
    btn.disabled = false;
  }
}

async function abrirExplorador() {
  carpetaActual = elemento('rootFolder').value.trim() || 'C:\\';
  elemento('folderModal').style.display = 'block';
  await cargarCarpetas(carpetaActual);
}

function cerrarExplorador() {
  elemento('folderModal').style.display = 'none';
}

async function cargarCarpetas(path) {
  carpetaActual = path;
  elemento('folderPathInput').value = path;

  try {
    const response = await request(
      `${SETTINGS_ENDPOINTS.folders}?path=${encodeURIComponent(path)}`
    );
    const list = elemento('folderList');
    list.innerHTML = '';

    if (response.parent) {
      const up = document.createElement('li');
      up.className = 'folder-up';
      up.textContent = '..';
      up.onclick = () => cargarCarpetas(response.parent);
      list.appendChild(up);
    }

    response.folders.forEach(folder => {
      const li = document.createElement('li');
      li.textContent = folder;
      li.onclick = () => cargarCarpetas(`${carpetaActual}\\${folder}`);
      list.appendChild(li);
    });
  } catch (error) {
    mostrar(error.message, false);
  }
}

function irARuta() {
  const path = elemento('folderPathInput').value.trim();
  if (path) {
    cargarCarpetas(path);
  }
}

function seleccionarCarpeta() {
  elemento('rootFolder').value = carpetaActual;
  cerrarExplorador();
}

document.addEventListener('DOMContentLoaded', () => {
  configurarDropZone();
  autenticar();
});