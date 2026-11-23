# POS Web

POS Web es la aplicación web del punto de venta. Está construida con Angular y
se sirve desde la misma aplicación ASP.NET Core que expone la API. La versión
actual es `1.8.0`.

La distribución recomendada es una sola aplicación:

```text
POSBackend/
├─ POSBackend.API.dll
├─ web.config
├─ appsettings.json
└─ wwwroot/
   ├─ index.html                 # POS Web compilado
   ├─ assets/
   │  └─ config.json             # Rutas runtime: /api y /hub
   ├─ ngsw.json                  # Service worker de producción
   └─ config/
      ├─ index.html              # Configuración nativa del backend
      ├─ css/
      └─ js/
```

El repositorio `dev-venalis/pos-web` contiene el paquete compilado para IIS.
Este directorio contiene el código fuente Angular y las instrucciones de
desarrollo; no se debe confundir con el artefacto compilado.

## 1. Cómo funciona

### Inicio de la aplicación

1. ASP.NET Core inicia la API y sirve `wwwroot`.
2. Angular carga [`src/assets/config.json`](src/assets/config.json) antes de
   arrancar. Por defecto contiene:

   ```json
   {
     "apiUrl": "/api",
     "hubUrl": "/hub"
   }
   ```

3. La aplicación carga en paralelo la configuración operativa, la botonera y
   las terminales.
4. La pantalla inicial permite seleccionar la terminal. Solo se muestran
   terminales cuya versión registrada coincide con la versión del frontend
   (`1.8.0`).
5. El usuario captura su código y clave de empleado en `/login`.
6. La API devuelve un JWT. POS Web lo conserva en `localStorage` y el
   interceptor agrega automáticamente a cada solicitud:
   - `Authorization: Bearer <token>`
   - `Terminal: <serie>`
   - `Version: 1.8.0`
   - credenciales de origen cuando corresponde.
7. El backend valida el token, la terminal y la versión antes de atender las
   operaciones protegidas.

El backend es la fuente de verdad. El frontend muestra el estado recibido y no
reimplementa reglas de negocio, bloqueo de impresión, permisos ni cálculo de
totales.

### Comunicación en tiempo real

Las actualizaciones de mesas y avisos de pedidos usan SignalR:

```text
Frontend: /hub
Hub real: /hub/Comandera
```

La conexión intenta WebSockets, Server-Sent Events y, como último recurso,
Long Polling. También tiene reconexión automática. En producción, al usar el
mismo origen, no se necesita un segundo servidor Node ni una URL fija de
desarrollo.

### Caching PWA

El service worker se activa únicamente en una build de producción. Cachea los
archivos estáticos del POS, pero excluye API, SignalR y `/config`. Después de
publicar una versión nueva, si el navegador conserva archivos anteriores,
recarga con `Ctrl+F5` o elimina los datos del sitio.

## 2. Requisitos

### Desarrollo

- Windows 10/11 o Windows Server.
- Node.js compatible con la versión de npm usada por el proyecto.
- npm disponible como `npm.cmd`.
- .NET 8 SDK para ejecutar la API.
- SQL Server accesible desde el equipo.
- Registros de terminales, usuarios, botonera y configuración en la base de
  datos.

### Producción en IIS

- ASP.NET Core Hosting Bundle de .NET 8.
- IIS con un sitio o aplicación apuntando a la carpeta publicada.
- Application Pool con `No Managed Code`.
- Permiso de lectura y ejecución sobre toda la carpeta publicada.
- Permiso de modificación sobre `appsettings.json` y `App_Data` si se usará
  `/config` para guardar la conexión o el logo.
- Permiso del usuario del Application Pool para acceder a SQL Server, a la
  carpeta de registros y a las impresoras configuradas.
- Windows 6.1 o superior para las funciones de impresión y generación de
  imágenes del ticket.

Node.js y npm son necesarios para compilar, pero no para ejecutar el artefacto
publicado.

## 3. Configuración inicial segura

### 3.1 Configuración base de `appsettings.json`

El archivo fuente debe conservarse sin contraseñas ni claves JWT:

```json
{
  "Server": {
    "Host": "localhost",
    "Port": 8080,
    "Scheme": "http"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "Jwt": {
    "Key": ""
  },
  "AllowedHosts": "*",
  "AllowedOriginsList": [],
  "ConnectionStrings": {
    "DefaultConnection": ""
  },
  "POS": {
    "rootFolder": "C:\\beh\\POS"
  }
}
```

El puerto predeterminado de la API y de la publicación integrada es `8080`.
No se deben agregar credenciales reales a este archivo dentro de Git.

### 3.2 Desarrollo con User Secrets

Desde la raíz del repositorio:

```powershell
dotnet user-secrets --project .\POSBackend\POSBackend.API.csproj init
dotnet user-secrets --project .\POSBackend\POSBackend.API.csproj set `
  "Jwt:Key" "<clave-aleatoria-de-al-menos-32-bytes>"
dotnet user-secrets --project .\POSBackend\POSBackend.API.csproj set `
  "ConnectionStrings:DefaultConnection" `
  "Data Source=SERVIDOR;Initial Catalog=BASE;User ID=USUARIO;Password=CLAVE;Trust Server Certificate=True"
```

La clave JWT debe tener al menos 32 bytes. Generar una clave aleatoria es
preferible a reutilizar una contraseña:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### 3.3 IIS y variables de entorno

En producción, configura los secretos mediante el proveedor de configuración
de IIS, variables de entorno o el mecanismo seguro de infraestructura:

```text
ASPNETCORE_ENVIRONMENT=Production
Jwt__Key=<clave-aleatoria-de-al-menos-32-bytes>
ConnectionStrings__DefaultConnection=<cadena-de-conexion>
Server__Host=<host-publicado>
Server__Port=8080
Server__Scheme=http
```

Para HTTPS, usa `Server__Scheme=https` y configura el binding/certificado en
IIS. No escribas las claves en este README, en `web.config` versionado ni en
el repositorio.

La cadena inicial debe permitir que el backend conozca como mínimo el servidor
y el usuario de SQL. La pantalla `/config` usa el nombre de la base de datos y
la contraseña capturados para comprobar la conexión y completar la cadena.

### 3.4 Carpeta de operación

`POS:rootFolder` es la carpeta donde el backend guarda los registros. Para una
instalación típica:

```text
C:\beh\POS\
└─ Registros\
   ├─ Tickets\Venta\YYYYMMDD\
   └─ Tickets\IMP1\YYYYMMDD\
```

La identidad del Application Pool debe poder crear subdirectorios y archivos
en esta ubicación.

## 4. Configuración web en `/config`

La configuración no es una pantalla Angular. Es una página nativa del backend
que vive en `wwwroot/config` y se conserva separada del POS.

Abre:

```text
http://localhost:8080/config
```

El backend redirige a `/config/index.html` y solicita autenticación web nativa.
El navegador muestra el diálogo de credenciales:

```text
username = nombre de la base de datos
password = contraseña de la base de datos
```

La autenticación prueba la conexión. Si es correcta, guarda la conexión en
`ConnectionStrings:DefaultConnection`. La contraseña nunca se devuelve en la
respuesta de lectura; solo se informa si existe una contraseña configurada.

> Importante: si el `appsettings.json` publicado está vacío, primero debe
> existir una cadena base mediante IIS/variables de entorno o una configuración
> local con el servidor y el usuario de SQL. Sin esos datos el backend no puede
> validar la primera entrada a `/config`.

### Opciones disponibles

#### Servidor

- Host.
- Puerto.

El puerto debe estar entre `1` y `65535`. El valor normal es `8080`.

#### Orígenes permitidos

Agrega únicamente orígenes concretos, por ejemplo:

```text
http://localhost:4200
https://pos.empresa.local
```

Para la publicación integrada no se necesita CORS para el propio POS porque
frontend y API comparten origen. No uses `*` junto con credenciales.

#### Conexión a base de datos

- Servidor SQL.
- Base de datos.
- Usuario.
- Contraseña.

El campo de contraseña vacío conserva la contraseña existente al guardar.
Usa **Probar conexión** antes de guardar.

#### Archivos de operación

Selecciona la carpeta donde se generarán los TXT y las imágenes de tickets.
El explorador de carpetas se ejecuta en el servidor, no en el equipo remoto
del navegador.

#### Imagen del ticket

La imagen se puede seleccionar con clic o arrastrar mediante drag and drop.
Características:

- PNG o JPG como entrada.
- Máximo 4 MB.
- Máximo 2048 × 2048 píxeles.
- Se normaliza y se guarda como `App_Data\LogoTicket.png`.

La carpeta `Recursos\Logos` no es la fuente activa del logo del ticket. Para
cambiarlo se debe usar `/config`.

El proceso de carga es:

```text
Seleccionar/arrastrar imagen
        ↓
Previsualización local
        ↓
POST /api/settings/ticket-image
        ↓
App_Data/LogoTicket.png
```

## 5. Ejecución local

### Opción A: API + Angular separado

Terminal 1, desde la raíz:

```powershell
dotnet run --project .\POSBackend\POSBackend.API.csproj
```

La API escucha en:

```text
http://localhost:8080
```

Terminal 2, desde `POSBackend.WEB`:

```powershell
npm ci
npm start
```

Angular escucha normalmente en:

```text
http://localhost:4200
```

El proxy de desarrollo reenvía `/api/**` y `/hub/**` a
`http://127.0.0.1:8080`. No cambies el host dentro del bundle para resolver
un problema de desarrollo.

### Opción B: probar solo el frontend compilado

```powershell
npm run build:production
npm run pwa:test
```

Esta opción levanta únicamente archivos estáticos en el puerto `8080`. No debe
ejecutarse al mismo tiempo que la API, porque ambos procesos intentarán usar el
mismo puerto y el frontend no tendrá la API disponible.

## 6. Publicación integrada API + POS Web

El proyecto `POSBackend.API.csproj` compila automáticamente el frontend antes
de publicar:

1. `npm.cmd ci`.
2. `npm.cmd run build`.
3. Toma `POSBackend.WEB\dist\posweb\browser`.
4. Copia el resultado a `publish\wwwroot`.
5. Publica la API, sus dependencias, `web.config` y la página `/config`.

Comando recomendado desde la raíz:

```powershell
dotnet publish .\POSBackend\POSBackend.API.csproj `
  -c Release `
  -o .\publish
```

La salida se instala completa en IIS. Debe contener al menos:

```text
publish/
├─ POSBackend.API.dll
├─ POSBackend.API.exe
├─ web.config
├─ appsettings.json
└─ wwwroot/
   ├─ index.html
   ├─ assets/
   ├─ ngsw.json
   └─ config/index.html
```

`npm` es el gestor predeterminado. Solo usa pnpm si el agente lo requiere:

```powershell
dotnet publish .\POSBackend\POSBackend.API.csproj `
  -c Release `
  -o .\publish `
  -p:PosWebPackageManager=pnpm.cmd
```

No copies manualmente el `dist` sobre `wwwroot` después de publicar. Eso puede
reemplazar archivos del backend o romper la página `/config`.

### Instalación en IIS

1. Instala el ASP.NET Core Hosting Bundle de .NET 8.
2. Crea el sitio o aplicación IIS apuntando a `publish`.
3. Usa un Application Pool con `No Managed Code`.
4. Configura el binding del sitio en `8080` o en el puerto HTTPS elegido.
5. Define `Jwt__Key` y `ConnectionStrings__DefaultConnection` fuera de Git.
6. Otorga lectura/ejecución al sitio y modificación en `appsettings.json`,
   `App_Data` y `POS:rootFolder` si se usará `/config`.
7. Reinicia el Application Pool.
8. Comprueba:

   ```text
   http://localhost:8080/config
   http://localhost:8080/
   http://localhost:8080/login
   ```

La aplicación publicada no necesita Node.js, Angular CLI ni un servidor Node.

## 7. Rutas de la aplicación

| Ruta | Uso | Seguridad |
| --- | --- | --- |
| `/` | Pantalla bloqueada, fecha, terminal, versión y base de datos mostrada | Pública |
| `/login` | Inicio de sesión del empleado | Requiere credenciales de empleado |
| `/pos` | Operación principal de mesas y tickets | JWT |
| `/pos/backscreen` | Vista secundaria/backscreen | JWT |
| `/comandera` | Seguimiento de comandas | JWT |
| `/mesas/:id` | Consulta relacionada con mesas | JWT |
| `/produccion` | Producción y finalización de productos | JWT |
| `/config` | Configuración nativa del backend | Basic/Cookie de configuración |

`/config` no debe confundirse con `/pos`; son aplicaciones distintas servidas
por el mismo proceso.

## 8. Casos de uso principales

### Login y bloqueo

1. Selecciona una terminal en la pantalla inicial.
2. Pulsa el teclado/acción de entrada.
3. Captura código y clave numéricos.
4. POS Web llama `POST /api/Usuario/Login`.
5. El JWT se guarda en la sesión local.
6. El usuario entra a `/pos`.
7. Al bloquear, se limpia el estado de mesa, ticket y botonera sin eliminar
   la configuración persistente.

La terminal seleccionada se conserva en una cookie llamada `terminal`.

### Consultar y crear mesas

- POS Web consulta `GET /api/Mesa`.
- Las mesas se agrupan por nombre.
- Al seleccionar una mesa se carga su ticket y segmento.
- Una nueva mesa usa `POST /api/Mesa`.
- La edición/transferencia usa `PUT /api/Mesa`.
- La API devuelve `bloqueoImpresion` y `mensajeBloqueo`; el frontend usa esos
  datos para habilitar u ocultar acciones.

### Navegar en la botonera

1. Las categorías se cargan desde `GET /api/Boton`.
2. Las subcategorías se consultan desde
   `GET /api/Boton/Subcategoria/{id}`.
3. La selección no inventa productos: muestra los botones que retorna la API.
4. Al cambiar de mesa o ticket, se limpia la categoría seleccionada.

### Agregar producto, comentario o combo

Todas estas acciones se envían al backend mediante `MesaProducto`:

- Producto: `POST /api/MesaProducto` con ticket y código.
- Comentario: producto especial con código `1005`.
- Combo: producto con `codigo` y `comboCategoria`.
- Renta: producto con el identificador de mesa de renta.
- Eliminar: `DELETE /api/MesaProducto/{folio}`.
- Editar/terminar: `PUT /api/MesaProducto`.

Los productos pendientes tienen `pendiente = 1`. Al ordenar, se envían al
backend y luego se recarga el ticket para que el estado mostrado sea el que
devuelve la API.

### Renta

La disponibilidad se consulta en `GET /api/Renta`. El botón solo debe mostrarse
cuando la API devuelve registros disponibles. La consulta de detalle y el
término de renta usan:

```text
GET  /api/Renta/{item}
POST /api/Renta/{item}
```

### Imprimir

El botón de impresión depende de todas estas condiciones:

- Existe un ticket seleccionado.
- El ticket tiene productos capturados.
- El backend no devuelve `bloqueoImpresion`.
- La configuración de reimpresión permite imprimir si ya fue impreso.

La solicitud principal es:

```text
GET /api/Impresora/Venta/{ticket}
```

La API:

1. Genera el TXT en `POS:rootFolder\Registros\Tickets\Venta\YYYYMMDD`.
2. Intenta imprimir en la impresora de tickets de la terminal.
3. Si la impresora no está disponible, no marca la operación como error de
   impresión bloqueante: genera un PNG junto al TXT.
4. Usa `App_Data\LogoTicket.png` cuando existe.
5. Guarda la versión y la terminal en la misma línea final del ticket, por
   ejemplo `v1.8.0-TERMINAL`.
6. Actualiza el estado de impresión y el bloqueo conforme a la regla del
   backend.

La imagen generada puede consultarse mediante:

```text
GET  /api/Impresora/Venta/{ticket}/Imagen
POST /api/Impresora/Venta/{ticket}/Imagen
```

La interfaz POS actual prioriza guardar el TXT y la imagen en los registros;
no depende de mostrar la imagen dentro de la pantalla.

Las comandas usan:

```text
GET /api/Impresora/Comanda/{ticket}
```

Si una impresora de comanda no está disponible, el backend registra un warning
y continúa con las demás estaciones.

### Bloqueo de impresión

El backend calcula `bloqueoImpresion` y `mensajeBloqueo` al consultar la mesa,
al consultar un ticket y al ejecutar operaciones que pueden modificarla.
POS Web consume ese flag en el panel, la botonera y las acciones del ticket.

El frontend no debe sustituirlo por una comparación local de `bloqueo == 1`.
Cuando el backend informa el bloqueo:

- Se ocultan las acciones de edición que no aplican.
- Se oculta impresión y reimpresión si la regla lo impide.
- La botonera no permite agregar operaciones incompatibles.
- El mensaje mostrado proviene de la respuesta del backend.

TOGO conserva sus reglas propias; no se debe asumir que todas las mesas tienen
el mismo flujo de impresión.

## 9. API y contratos relevantes

Las rutas principales consumidas por POS Web son:

```text
POST /api/Usuario/Login
GET  /api/Configuracion
GET  /api/Terminal
GET  /api/Boton
GET  /api/Boton/Subcategoria/{id}
GET  /api/Mesa
POST /api/Mesa
PUT  /api/Mesa
GET  /api/Mesa/{ticket}
POST /api/MesaProducto
PUT  /api/MesaProducto
DELETE /api/MesaProducto/{folio}
GET  /api/Combo/Producto/{producto}
GET  /api/Impresora
GET  /api/Impresora/Venta/{ticket}
GET  /api/Impresora/Comanda/{ticket}
GET  /api/Renta
GET  /api/Pedido
POST /api/Pedido/Recibir
GET  /api/Notificacion
```

La configuración nativa usa:

```text
POST /api/settings/login
POST /api/settings/logout
GET  /api/settings
PUT  /api/settings
POST /api/settings/test-connection
GET  /api/settings/folders
GET  /api/settings/ticket-image
POST /api/settings/ticket-image
```

Las respuestas operativas usan el contrato:

```json
{
  "success": true,
  "data": {},
  "message": ""
}
```

El contenido exacto de `data` depende de la operación. El frontend debe leer
la respuesta y no duplicar reglas en el cliente.

## 10. Seguridad y operación

- No subas `appsettings.json` con contraseña o JWT.
- No incluyas `dev2025`, `wrjua1`, User Secrets, certificados ni archivos
  `.pdb` en un repositorio de distribución.
- Usa HTTPS fuera de localhost.
- Protege `/config`; no lo expongas públicamente sin autenticación.
- Limita `AllowedOriginsList` a orígenes conocidos.
- No uses `Access-Control-Allow-Origin: *` con credenciales.
- Mantén permisos de escritura de `appsettings.json` y `App_Data` limitados a
  la identidad del sitio IIS.
- Haz copia segura de `appsettings.json` antes de actualizar la publicación,
  porque `/config` guarda allí la conexión cuando se completa el bootstrap.
- El repositorio de GitHub de distribución contiene binarios y archivos
  estáticos, no el código fuente del frontend ni de la API.

## 11. Solución de problemas

### Las mesas se quedan cargando

Comprueba, en este orden:

1. La API responde en `http://localhost:8080`.
2. `ConnectionStrings:DefaultConnection` permite conectar con SQL Server.
3. El usuario tiene un JWT vigente.
4. La cookie `terminal` tiene una terminal existente.
5. La terminal tiene `versionPOS = 1.8.0`.
6. La solicitud `GET /api/Mesa` no devuelve `401`, `400` o `404`.
7. El Application Pool tiene acceso a la base de datos.

### No aparecen subcategorías o productos

Revisa `GET /api/Boton` y
`GET /api/Boton/Subcategoria/{id}` en las herramientas del navegador.
Después confirma que los registros de botonera están asociados a la categoría,
subcategoría y producto correctos.

### Aparece un error de CORS o SignalR

En desarrollo debe estar activo el proxy de Angular y la API debe escuchar en
`8080`. En producción usa `/api` y `/hub` relativos. No abras otro servidor
Node ni cambies `src/assets/config.json` para poner `tester-z:9095` u otro host
fijo.

### `/config` devuelve 401

Es esperado antes de proporcionar las credenciales nativas. Si las credenciales
correctas también fallan:

- Verifica que el nombre de usuario sea el nombre de la base de datos.
- Verifica la contraseña de SQL.
- Comprueba que la cadena base tenga servidor y usuario.
- Confirma que el sitio IIS pueda leer y escribir `appsettings.json`.
- Revisa el log de ASP.NET Core.

### No se imprime el ticket

Confirma:

- Ticket seleccionado.
- Productos capturados.
- `bloqueoImpresion` en la respuesta de la API.
- Configuración de reimpresión.
- Impresora configurada para la terminal.
- Usuario del Application Pool con acceso a la impresora.
- `POS:rootFolder` con permisos de escritura.

Aunque la impresora no exista, debe quedar el TXT y, si la generación es
posible, el PNG en `Registros\Tickets\Venta`.

### El navegador muestra una versión anterior

La build de producción usa service worker. Realiza una recarga forzada, cierra
otras pestañas del sitio y, si es necesario, elimina el almacenamiento del
sitio para que se descargue el nuevo `ngsw.json`.

## 12. Pruebas y validación

Desde `POSBackend.WEB`:

```powershell
npm ci
npm run build:production
npm run test:ci
```

Desde la raíz:

```powershell
dotnet test .\POSBackend.sln
dotnet publish .\POSBackend\POSBackend.API.csproj `
  -c Release `
  -o .\publish
```

Checklist mínimo antes de entregar:

- [ ] La build de Angular termina sin errores.
- [ ] La API inicia en el puerto configurado.
- [ ] `/config` solicita autenticación.
- [ ] La conexión SQL se prueba y se guarda.
- [ ] El logo se carga por drag and drop y queda como `App_Data\LogoTicket.png`.
- [ ] El usuario puede seleccionar terminal e iniciar sesión.
- [ ] Las mesas, categorías y productos cargan.
- [ ] Se puede crear una mesa y agregar un producto.
- [ ] El botón de impresión respeta ticket, productos, bloqueo y reimpresión.
- [ ] La impresión genera TXT y el fallback PNG cuando no hay impresora.
- [ ] SignalR actualiza mesas/pedidos o permite el fallback configurado.
- [ ] La publicación contiene API, `wwwroot` y `/config`.
- [ ] No hay secretos en el artefacto ni en Git.

## 13. Cambiar la versión

La versión de `package.json` se envía al backend mediante el header `Version`,
se usa para filtrar terminales y se imprime como `v<version>-<TERMINAL>` en el
ticket.

Para actualizarla:

1. Cambia `version` en `package.json`.
2. Regenera `package-lock.json` si corresponde.
3. Verifica que las terminales de la base de datos tengan la misma versión.
4. Ejecuta `npm run build:production`.
5. Ejecuta `dotnet publish`.
6. Prueba login, mesas, productos, impresión y bloqueo.

No publiques una versión nueva hasta que API y terminales soporten el mismo
valor.
