let alumnoActual = null;
let productos = [];
let carrito = {};
let unsubscribeMenu = null;
let unsubscribePedidos = null;
let qrActual = "";

const $ = id => document.getElementById(id);

function mensaje(id, txt, error = false) {
    $(id).textContent = txt;
    $(id).classList.toggle("error", error);
}

function validarTexto(v) {
    return typeof v === "string" &&
        v.trim().length > 0 &&
        v.trim().length <= 100;
}

// INICIAR SESIÓN ANÓNIMA
async function iniciarAlumno() {
    if (!esConfiguracionLista) {
        mensaje("registroMsg", "Primero configura Firebase en js/firebase.js.", true);
        return;
    }

    try {
        if (!auth.currentUser) {
            await auth.signInAnonymously();
        }
    } catch (e) {
        mensaje("registroMsg", "No se pudo conectar. Revisa la configuración de Firebase.", true);
    }
}

// REGISTRO DEL ALUMNO
$("formAlumno").addEventListener("submit", async e => {
    e.preventDefault();

    await iniciarAlumno();

    if (!auth.currentUser) return;

    const nombre = $("nombre").value.trim();
    const grupo = $("grupo").value.trim();
    const semestre = $("semestre").value;

    if (
        !validarTexto(nombre) ||
        !/^[A-Za-z0-9 -]{1,12}$/.test(grupo) ||
        !semestre
    ) {
        mensaje("registroMsg", "Revisa tus datos. No se permiten campos vacíos ni caracteres no válidos.", true);
        return;
    }

    alumnoActual = {
        uid: auth.currentUser.uid,
        nombre,
        grupo,
        semestre
    };

    try {
        await db.collection("alumnos")
            .doc(alumnoActual.uid)
            .set({
                nombre,
                grupo,
                semestre,
                actualizado: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

        $("registro").hidden = true;
        $("zonaAlumno").hidden = false;

        $("saludo").textContent = `Hola, ${nombre}`;

        escucharMenu();
        escucharMisPedidos();

    } catch (err) {
        mensaje("registroMsg", "No fue posible guardar tus datos. Intenta de nuevo.", true);
    }
});

// CAMBIAR DE ALUMNO Y CERRAR SESIÓN
$("cambiarAlumno").onclick = async () => {
    try {
        // Detener consultas anteriores
        if (unsubscribePedidos) {
            unsubscribePedidos();
            unsubscribePedidos = null;
        }

        if (unsubscribeMenu) {
            unsubscribeMenu();
            unsubscribeMenu = null;
        }

        // Cerrar sesión anterior
        await auth.signOut();

        // Limpiar datos del alumno anterior
        alumnoActual = null;
        carrito = {};
        productos = [];
        qrActual = "";

        // Limpiar formularios
        $("nombre").value = "";
        $("grupo").value = "";
        $("semestre").value = "";

        $("misPedidos").innerHTML = "";
        $("menuAlumno").innerHTML = "";

        $("qr").innerHTML = "";
        $("qrModal").hidden = true;

        renderCarrito();

        // Regresar al registro
        $("zonaAlumno").hidden = true;
        $("registro").hidden = false;

        mensaje("registroMsg", "Sesión cerrada. Puede ingresar otro alumno.");

    } catch (error) {
        mensaje("registroMsg", "No se pudo cerrar la sesión. Intenta nuevamente.", true);
    }
};

// CARGAR MENÚ
function escucharMenu() {
    if (unsubscribeMenu) unsubscribeMenu();

    unsubscribeMenu = db.collection("menu")
        .where("activo", "==", true)
        .onSnapshot(s => {
            productos = s.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            renderMenu();

        }, () => {
            $("menuAlumno").textContent = "No se pudo cargar el menú.";
        });
}

// MOSTRAR PLATILLOS
function renderMenu() {
    $("menuAlumno").innerHTML = productos.length
        ? productos.map(p => `
            <article class="platillo">
                ${p.imagen ? `
                    <img
                        src="${escapar(p.imagen)}"
                        alt="${escapar(p.nombre)}"
                        loading="lazy"
                        onerror="this.hidden=true"
                    >
                ` : ""}

                <div class="platillo-info">
                    <h3>${escapar(p.nombre)}</h3>

                    <p>${escapar(p.descripcion || "Platillo disponible en cafetería.")}</p>

                    <div class="precio">${dinero(p.precio)}</div>

                    <button class="boton principal" data-add="${p.id}">
                        Agregar al pedido
                    </button>
                </div>
            </article>
        `).join("")
        : "<p class='muted'>Todavía no hay platillos disponibles.</p>";

    $("menuAlumno").querySelectorAll("[data-add]").forEach(b => {
        b.onclick = () => {
            carrito[b.dataset.add] = (carrito[b.dataset.add] || 0) + 1;
            renderCarrito();
        };
    });
}

// MOSTRAR CARRITO
function renderCarrito() {
    const items = productos
        .filter(p => carrito[p.id])
        .map(p => ({
            ...p,
            cantidad: carrito[p.id]
        }));

    $("carritoLista").innerHTML = items.length
        ? items.map(p => `
            <div class="fila-carrito">
                <span>
                    <b>${escapar(p.nombre)}</b><br>
                    <small>${p.cantidad} × ${dinero(p.precio)}</small>
                </span>

                <span>
                    <b>${dinero(p.precio * p.cantidad)}</b>
                    <button data-remove="${p.id}" aria-label="Quitar uno">−</button>
                </span>
            </div>
        `).join("")
        : "<p class='muted'>Aún no agregas productos.</p>";

    $("carritoLista").querySelectorAll("[data-remove]").forEach(b => {
        b.onclick = () => {
            const id = b.dataset.remove;

            if (--carrito[id] <= 0) {
                delete carrito[id];
            }

            renderCarrito();
        };
    });

    $("total").textContent = dinero(
        items.reduce((s, p) => s + p.precio * p.cantidad, 0)
    );
}

// MÉTODO DE PAGO
$("pago").onchange = () => {
    $("transferenciaInfo").hidden =
        $("pago").value !== "Transferencia";
};

// REGISTRAR PEDIDO
$("formPedido").addEventListener("submit", async e => {
    e.preventDefault();

    if (!alumnoActual || !auth.currentUser ||
        auth.currentUser.uid !== alumnoActual.uid) {
        mensaje("pedidoMsg", "Tu sesión no está activa. Vuelve a ingresar.", true);
        return;
    }

    const items = productos
        .filter(p => carrito[p.id])
        .map(p => ({
            productoId: p.id,
            nombre: p.nombre,
            precio: Number(p.precio),
            cantidad: carrito[p.id]
        }));

    if (!items.length) {
        mensaje("pedidoMsg", "Agrega al menos un platillo.", true);
        return;
    }

    if (!$("pago").value) {
        mensaje("pedidoMsg", "Selecciona una forma de pago.", true);
        return;
    }

    const total = items.reduce(
        (s, p) => s + p.precio * p.cantidad, 0
    );

    const metodo = $("pago").value;

    const pedido = {
        alumnoUid: alumnoActual.uid,
        alumno: alumnoActual.nombre,
        grupo: alumnoActual.grupo,
        semestre: alumnoActual.semestre,
        items,
        total,
        metodoPago: metodo,
        estado: "Recibido",
        pagoEstado: metodo === "Efectivo"
            ? "Pendiente de pago"
            : "Pendiente de validación",
        fecha: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        const ref = await db.collection("pedidos").add(pedido);

        qrActual = JSON.stringify({
            pedidoId: ref.id,
            alumno: alumnoActual.nombre,
            grupo: alumnoActual.grupo,
            fecha: new Date().toLocaleString("es-MX"),
            items,
            total,
            metodoPago: metodo
        });

        $("qr").innerHTML = "";

        new QRCode($("qr"), {
            text: qrActual,
            width: 210,
            height: 210
        });

        $("qrDatos").textContent =
            `Folio: ${ref.id} · Total: ${dinero(total)}`;

        $("qrModal").hidden = false;

        carrito = {};
        renderCarrito();

        mensaje("pedidoMsg", "Pedido enviado correctamente.");

    } catch (err) {
        mensaje("pedidoMsg", "No se pudo registrar el pedido. Intenta nuevamente.", true);
    }
});

// CERRAR VENTANA QR
$("cerrarQr").onclick = () => {
    $("qrModal").hidden = true;
};

// DESCARGAR QR
$("descargarQr").onclick = () => {
    const canvas = $("qr").querySelector("canvas");

    if (!canvas) return;

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "codigo-qr-pedido.png";
    a.click();
};

// CONSULTAR PEDIDOS DEL ALUMNO ACTUAL
function escucharMisPedidos() {
    if (unsubscribePedidos) {
        unsubscribePedidos();
        unsubscribePedidos = null;
    }

    unsubscribePedidos = db.collection("pedidos")
        .where("alumnoUid", "==", alumnoActual.uid)
        .where("alumno", "==", alumnoActual.nombre)
        .where("grupo", "==", alumnoActual.grupo)
        .onSnapshot(s => {

            const docs = s.docs
                .map(d => ({
                    id: d.id,
                    ...d.data()
                }))
                .sort((a, b) =>
                    (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0)
                );

            $("misPedidos").innerHTML = docs.length
                ? docs.map(p => `
                    <div class="fila-carrito">
                        <span>
                            <b>Folio: ${escapar(p.id.slice(0, 8))}</b>
                            <small>
                                ${(p.items || []).map(i =>
                                    `${escapar(i.nombre)} × ${i.cantidad}`
                                ).join(", ")}
                                · ${dinero(p.total)}
                                · ${escapar(p.metodoPago)}
                            </small>
                        </span>

                        <span class="estado ${
                            p.estado === "Cancelado"
                                ? "cancelado"
                                : p.estado === "Finalizado"
                                    ? "finalizado"
                                    : ""
                        }">
                            ${escapar(p.estado)}
                        </span>
                    </div>
                `).join("")
                : "<p class='muted'>Todavía no tienes pedidos.</p>";

        }, error => {
            $("misPedidos").textContent =
                "No se pudieron consultar tus pedidos.";
        });
}

// INICIAR CARRITO VACÍO
renderCarrito();
