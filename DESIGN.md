# Mult Security · notas de diseño (versión nueva)

Mejora sobre la página existente: mismos textos, marca y colores. HTML y CSS planos, sin librerías,
porque es una página de una sola pantalla que debe cargar rápido en celular.

## Concepto
Idea:        La puerta Mult Security se ve fina por fuera y por dentro es acero que cierra por tres lados.
Metáfora:    El multibloqueo: pasadores de acero que entran al marco.
Firma:       Dibujo del cierre en la sección de puertas: al aparecer en pantalla, los pasadores
             laterales y el superior entran al marco.
Emoción:     Confianza tranquila. Nada salta; todo encaja.
Verbo:       "Encaja como un pasador": desliza una distancia corta y se detiene firme
             (cubic-bezier(.2,.8,.2,1), 260 ms; el dibujo 700 ms con 80 ms entre pasadores).
Captura:     El dibujo de la puerta con los pasadores ya dentro del marco.

## Sistema
- Colores: fondo #f3f2f7, tinta #1d1a33, apagado #4a4766, línea #e2e0ea, profundo #231f3f, verde #1f7a33 / #14551f, neón #6fd37f.
- Letra: Roboto 400/500/700/900 (la de la marca).
- Bordes: 8 px en tarjetas y fotos, 6 px en botones.
- Interacción: botones se llenan de izquierda a derecha como un pasador que entra; enlaces del menú
  con una barra que entra desde la izquierda; tarjetas y fotos suben 4 px.
- En reposo la página queda quieta a propósito: es un negocio de confianza, no una vitrina de efectos.
- Movimiento reducido: sin transiciones, el dibujo aparece ya cerrado.
