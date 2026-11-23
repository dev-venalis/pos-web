# pos-web

Este repositorio contiene el compilado publicable del POS Web junto con la API ASP.NET Core.

## Instalación y configuración inicial

1. Descarga o clona el repositorio en la carpeta de publicación.
2. Crea la configuración local a partir de la plantilla:

```powershell
Copy-Item .\appsettings.example.json .\appsettings.json
```

3. Configura la cadena de conexión y la clave JWT mediante `/config`, variables de entorno o un proveedor de secretos de IIS.
4. Ejecuta `POSBackend.API.exe` o registra la carpeta como aplicación en IIS.

La plantilla usa `localhost:8080`, usuario SQL `sa`, contraseña vacía y no fija un nombre de base de datos. Debes completar la conexión antes de usar el POS.

## URLs

- POS Web: `http://localhost:8080/pos`
- Configuración: `http://localhost:8080/config`
- API: mismo origen bajo `/api`

La API y el POS Web se sirven desde el mismo origen; no se debe cambiar el host dentro del bundle. `/config` es una pantalla nativa independiente.

## Desarrollo y publicación

La publicación se genera desde `POSBackend/POSBackend.API.csproj` con npm por defecto:

```powershell
dotnet publish POSBackend\POSBackend.API.csproj -c Release -o .\publish
```

La build Angular se incorpora como `wwwroot` del API. Si necesitas pnpm, puedes seleccionarlo explícitamente con `-p:PosWebPackageManager=pnpm.cmd`.

## Configuración local y `git pull`

`appsettings.json` está excluido por `.gitignore` y no se publica en este repositorio. Solo se versiona `appsettings.example.json`. Por eso un `git pull` futuro no reemplaza la configuración local del equipo.

En instalaciones existentes que todavía tengan `appsettings.json` rastreado, respáldalo, restáuralo temporalmente a la versión de Git, actualiza el repositorio y vuelve a copiar la configuración local:

```powershell
Copy-Item .\appsettings.json .\appsettings.local.backup.json
git restore --source=HEAD -- .\appsettings.json
git pull
Copy-Item .\appsettings.local.backup.json .\appsettings.json
Remove-Item .\appsettings.local.backup.json
```

No subas claves JWT, contraseñas ni cadenas de conexión reales.
