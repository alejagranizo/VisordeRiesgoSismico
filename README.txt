====================================================
  MERISUR - INSTRUCCIONES DE INSTALACIÓN
====================================================

PROGRAMAS QUE HAY QUE INSTALAR
----------------------------------

1. Node.js
   - Descarga: https://nodejs.org
   - Elige la versión LTS
   - Instálalo con las opciones por defecto

2. MongoDB Community Server
   - Descarga: https://www.mongodb.com/try/download/community
   - Elige la versión más reciente, sistema operativo Windows
   - Durante la instalación, asegúrate de que la opción
     "Install MongoDB as a Service" esté marcada
   - Esto hace que MongoDB arranque automáticamente con Windows


====================================================
  PASOS PARA EJECUTAR EL PROYECTO
====================================================

1. ABRIR EL CMD EN LA CARPETA DEL PROYECTO
   - Abre un cmd (Símbolo de Sistema) y escribe: cd y el directorio donde esta la carpeta (P.ej. cd C:\Users\Documents\merisurNode20260428 )
   - Dar al enter

2. INSTALAR DEPENDENCIAS
   - En el CMD ejecuta:
     npm install

3. IMPORTAR LA BASE DE DATOS (Para no tener que crear un usuario de nuevo)
   - En el CMD ejecuta:
     mongorestore --db merisurDB ./backup/merisurDB
   - Usuario: prueba Contraseña: prueba

4. ARRANCAR EL SERVIDOR
   - En el CMD ejecuta:
     node app.js
   - Deberia salir algo así:
	Servidor en http://localhost:3000
	MongoDB conectado

5. ABRIR LA APLICACIÓN
   - Abre tu navegador y ve a:
     http://localhost:3000


====================================================
  NOTAS
====================================================

- Para parar el servidor: pulsa Ctrl + C en el CMD
- Para volver a arrancar: node app.js en el CMD
- Si MongoDB no está corriendo, ábrelo desde Servicios de Windows
  o ejecuta en CMD (como administrador): net start MongoDB