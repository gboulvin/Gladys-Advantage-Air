# Advantage Air

Controle su climatización por conductos **Advantage Air** — sistemas
**MyAir**, **e-zone** y **MyPlace** — desde Gladys. La integración se
comunica con la tableta de pared del sistema a través de su **red local**:
sin cuenta ni nube, funciona incluso sin Internet.

## Presentación

Una vez configurada, la integración encuentra todos los dispositivos del
sistema:

- **Aires acondicionados**: encendido/apagado, modo (frío, calor,
  ventilación, deshumidificar y MyAuto si está disponible), consigna
  (16–32 °C), velocidad del ventilador (baja, media, alta, auto / MyFan),
  temporizadores de encendido y apagado (minutos), aire fresco si existe.
- **Zonas**: abrir / cerrar, apertura (5–100 %) de las zonas sin sensor de
  temperatura; temperatura, consigna, **MyZone**, señal del sensor y
  movimiento (si el sensor lo detecta) de las zonas con sensor.
- **MyLights**: encendido/apagado y brillo de las luces regulables.
- **MyThings**: persianas y puertas de garaje (abrir / cerrar), luces y
  relés.

## Requisitos previos

- Un sistema Advantage Air cuya tableta de pared ejecute la aplicación
  **MyAir**, **e-zone** o **MyPlace**. Mantenga la aplicación abierta: es la
  que sirve la API local.
- La tableta y Gladys en la **misma red local**.
- Una **dirección IP fija** para la tableta: resérvela en su router
  (reserva DHCP).
- Gladys 5.3 o posterior.

## Configuración

1. Busque la dirección IP de la tableta (ajustes de Android → Acerca de la
   tableta → Estado, o la lista de dispositivos de su router).
2. En Gladys, abra la pestaña **Configuración** de la integración e
   introdúzcala en **Dirección IP de la tableta**. Mantenga el puerto
   **2025**.
3. Si lo desea, cambie el **Intervalo de actualización** (15 segundos por
   defecto, de 5 a 300).
4. Guarde y pulse **Probar la conexión**: la integración enumera los aires
   acondicionados, zonas, luces y canales MyThings encontrados.
5. Abra la pestaña **Descubrimiento** y añada los dispositivos que desee.

## Escenas

- Disparadores: **Aire acondicionado encendido o apagado**, **Modo de
  climatización cambiado**, **El filtro necesita limpieza**, **Error del aire
  acondicionado**, **Zona abierta o cerrada**, **Movimiento detectado en una
  zona**. Sus detalles se pueden leer en las acciones siguientes, p. ej.
  `{{triggerEvent.data.error_code}}`.
- Acciones: **Controlar un aire acondicionado** (encendido, modo, ventilador
  y consigna en un solo comando), **Controlar una zona**, **Abrir o cerrar
  todas las zonas**, **Definir la MyZone**, **Programar un temporizador**
  (0 minutos lo cancela).

## Panel

- Widget **Aire acondicionado**: consigna y temperatura de la MyZone (en
  directo), encendido, modo, ventilador, filtro, error y temporizadores, con
  un botón para encender o apagar el equipo.
- Widget **Zonas**: estado, apertura y temperatura de cada zona, con botones
  para abrirlas o cerrarlas todas.

## Solución de problemas

- **«La tableta Advantage Air no responde»**: compruebe que la tableta está
  encendida, que la aplicación está abierta y que la dirección no ha
  cambiado. Abra `http://<dirección de la tableta>:2025/getSystemData` en un
  navegador de la misma red: debería verse un documento JSON.
- **Un cambio vuelve a su valor anterior**: el equipo lo rechazó. La
  integración muestra siempre el estado confirmado por la tableta.
- **Seguridad**: la API local de la tableta no tiene contraseña. No exponga
  nunca el puerto 2025 a Internet.
