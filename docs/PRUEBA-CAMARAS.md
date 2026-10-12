# Prueba de video en vivo con tu equipo (pendiente de realizar)

Todo está listo para probar con el grabador real (Dahua DH-XVR5108HS-X u otro ONVIF/RTSP). Sin equipo, el visor ya
se probó con la **señal simulada** (rotulada «SIMULADO · no es video real»).

## Antes de empezar

1. El XVR conectado por cable al mismo router que esta PC y encendido.
2. Mapa abierto con `INICIAR-MAPA.bat` (http://127.0.0.1:8360).
3. go2rtc descargado: https://github.com/AlexxIT/go2rtc/releases (archivo `go2rtc_win64.zip`), descomprimido en una carpeta.

## Pasos

1. Herramientas (⋯) → **Cámaras**. Abre «Video en vivo · lista de verificación».
2. Si no aparece tu grabador: **Buscar en mi red (ONVIF)** o escribe la IP del XVR → **Probar conexión** → **Guardar**.
3. Marca los canales que usarás y **Guardar canales**. **Ubicar** cada canal y haz clic en el mapa donde está la cámara.
4. Pulsa **Generar go2rtc.yaml**. El aviso indica la ruta del archivo y el comando; en la carpeta de go2rtc ejecuta:
   `go2rtc.exe -config "<ruta indicada>"` (deja esa ventana abierta). El archivo contiene tu contraseña: no lo compartas.
5. **Volver a comprobar**: deberían quedar en ✓ «go2rtc en ejecución» y «Flujos cargados en go2rtc».
6. Abre un canal (**Ver** o clic en su punto del mapa). Al conectar, la etiqueta cambia a **● EN VIVO · WebRTC** y se muestra
   el retraso aproximado. «Señal del grabador llegando a go2rtc» pasa a ✓ al pedir el canal.

## Qué significa cada resultado

| Etiqueta en la ventana | Significado | Qué hacer |
|---|---|---|
| ● EN VIVO · WebRTC | Video continuo desde go2rtc | Nada: funciona |
| FOTO ~1 s + motivo | WebRTC no conectó; se muestran fotos del grabador | Lee el motivo: suele ser go2rtc cerrado o el flujo ausente en go2rtc.yaml |
| FOTO · sin go2rtc | go2rtc no está en ejecución | Paso 4 |
| sin imagen: revisa la conexión | Ni fotos llegan | Revisa IP, usuario/contraseña y que el XVR esté en la misma red |
| SIMULADO | Señal de prueba generada en el navegador | Solo para probar el visor; no es video real |

## Qué anotar para el informe de la prueba

- Modo alcanzado por canal (WebRTC / foto), retraso aproximado y número de cortes en 10 minutos.
- Uso de CPU de la PC con 1, 4 y 8 canales abiertos (Administrador de tareas).
- Si algún canal cae a «FOTO», el motivo que muestra la ventana.

Privacidad (Ley N.° 29733): avisos de videovigilancia, sin captar espacios privados de terceros, sin reconocimiento
facial ni identificación de personas.
