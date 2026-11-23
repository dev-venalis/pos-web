# pos-web

## Desarrollo

Instala dependencias y ejecuta Angular con npm:

```powershell
npm ci
npm start
```

El proxy de desarrollo apunta a `http://localhost:8080`. En producción la aplicación
usa únicamente [`src/assets/config.json`](src/assets/config.json), con rutas relativas
para API y SignalR; no se debe cambiar el host dentro del bundle.

## Secretos y configuración del API

`POSBackend/appsettings.json` no contiene claves JWT ni credenciales de SQL. Para
desarrollo, configúralas con User Secrets:

```powershell
dotnet user-secrets --project ..\POSBackend\POSBackend.API.csproj set "Jwt:Key" "<clave-de-32-bytes-o-mas>"
dotnet user-secrets --project ..\POSBackend\POSBackend.API.csproj set "ConnectionStrings:DefaultConnection" "<cadena-de-conexion>"
```

En producción usa el proveedor de secretos de IIS o variables de entorno:
`Jwt__Key`, `ConnectionStrings__DefaultConnection` y, si corresponde,
`Server__Scheme=https`. No guardes esos valores en Git ni habilites
`TrustServerCertificate` salvo una excepción controlada del entorno.

## Publicación junto con POSBackend

`POSBackend/POSBackend.API.csproj` ejecuta automáticamente `npm.cmd ci` y
`npm.cmd run build` antes de publicar el API. La salida
`dist/posweb/browser` se incorpora como `wwwroot` del publish y contiene
el sitio `/pos`.

Para publicar:

```powershell
dotnet publish POSBackend\POSBackend.API.csproj -c Release -o .\publish
```

Si el agente solo dispone de pnpm, se puede seleccionar explícitamente la alternativa:

```powershell
dotnet publish POSBackend\POSBackend.API.csproj -c Release -o .\publish `
  -p:PosWebPackageManager=pnpm.cmd
```

La publicación resultante se instala como una única aplicación ASP.NET Core en IIS,
con `8080` como puerto predeterminado. El POS Web queda disponible en
`http://localhost:8080/pos` y la API en el mismo origen.
`/config` es una página nativa independiente dentro de `wwwroot/config`; no debe
reemplazarse con el contenido de `dist/posweb/browser`.

Durante el desarrollo, `npm start` conserva el servidor Angular en `4200` y utiliza
el proxy hacia la API en `8080`. No se deben ejecutar dos procesos independientes
en el mismo puerto. Para probar únicamente el build estático en `8080`, usa
`npm run pwa:test`; esa prueba no debe ejecutarse al mismo tiempo que la API
integrada.
