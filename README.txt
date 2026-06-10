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

3. MongoDB Compass (interfaz gráfica para la base de datos)
   - Descarga: https://www.mongodb.com/try/download/compass
   - Se usa para importar los usuarios existentes

4. Python 3.10
   - Descarga: https://www.python.org/downloads/release/python-3100/
   - En la instalación marca "Add Python to PATH"
   - Versión recomendada: 3.10.x (otras versiones pueden dar
     problemas con algunas dependencias com pygmm)


====================================================
  PASOS PARA EJECUTAR EL PROYECTO
====================================================

1. ABRIR EL CMD EN LA CARPETA DEL PROYECTO
   - Abre un cmd (Símbolo de Sistema) y escribe:
     cd y el directorio donde está la carpeta
     (P.ej. cd C:\Users\Documents\merisurNode)
   - Pulsa Enter

2. INSTALAR DEPENDENCIAS NODE
   - En el CMD ejecuta:
     npm install

3. CREAR EL ENTORNO VIRTUAL DE PYTHON (solo la primera vez o si no se tiene de antes)
   - Entra en la carpeta pythonCode:
     cd pythonCode
   - Crea el entorno virtual:
     python -m venv env
   - Actívalo:
     env\Scripts\activate
   - Instala las dependencias Python:
     pip install -r ..\requirements.txt
   - Vuelve a la carpeta raíz del proyecto:
     cd ..

   NOTA: Si el entorno virtual ya existe (carpeta pythonCode\env
   presente), puedes saltar este paso.

4. IMPORTAR LA BASE DE DATOS DE USUARIOS
   - Abre MongoDB Compass y conéctate a:
     mongodb://localhost:27017
   - Crea la base de datos: merisurDB
   - Dentro de merisurDB, crea la colección: users
   - Con la colección users seleccionada, haz clic en:
     Add Data -> Import JSON or CSV file
   - Selecciona el archivo users.json incluido en la carpeta backup/
   - Haz clic en Import
   - Usuario de prueba: prueba  |  Contraseña: prueba

5. ARRANCAR EL SERVIDOR
   - En el CMD (desde la carpeta raíz del proyecto) ejecuta:
     node app.js
   - Debería salir algo así:
     Servidor en http://localhost:3000
     MongoDB conectado

6. ABRIR LA APLICACIÓN
   - Abre tu navegador y ve a:
     http://localhost:3000


====================================================
  NOTAS
====================================================

- Para parar el servidor: pulsa Ctrl + C en el CMD
- Para volver a arrancar: node app.js en el CMD
- Si MongoDB no está corriendo, ábrelo desde Servicios de Windows
  o ejecuta en CMD (como administrador): net start MongoDB
- El entorno virtual solo hay que crearlo una vez. En sucesivos
  arranques no hace falta activarlo manualmente porque el servidor
  Node lo invoca directamente a través de la variable PYTHON_EXE
  del archivo .env