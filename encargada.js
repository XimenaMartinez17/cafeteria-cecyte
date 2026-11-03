
/* =========================================
   PANEL DE ENCARGADA - CAFETERÍA ESCOLAR
========================================= */

// ELEMENTOS HTML
const $ = id => document.getElementById(id);

// ESCUCHAS DE FIREBASE
let stopMenu = null;
let stopPedidos = null;

// EVITAR INICIAR VARIAS VECES
let adminIniciado = false;


/* =========================================
   MENSAJES
========================================= */

function msg(id, texto, error = false) {
    const elemento = $(id);

    if (!elemento) return;

    elemento.textContent = texto;
    elemento.classList.toggle("error", error);
}


/* =========================================
   COMPROBAR ENCARGADA
========================================= */

function autorizado(user) {
    return !!user &&
        !!user.email &&
        CORREOS_AUTORIZADOS
            .map(correo => correo.toLowerCase())
            .includes(user.email.toLowerCase());
}


/* =========================================
   DETENER ESCUCHAS
========================================= */

function detenerEscuchas() {

    if (stopMenu) {
        stopMenu();
        stopMenu = null;
    }

    if (stopPedidos) {
        stopPedidos();
        stopPedidos = null;
    }

    adminIniciado = false;
}


/* =========================================
   MOSTRAR LOGIN
========================================= */

function mostrarLogin() {
    $("loginEncargada").hidden = false;
    $("panelEncargada").hidden = true;
}


/* =========================================
   MOSTRAR PANEL
========================================= */

function mostrarPanel() {
    $("loginEncargada").hidden = true;
    $("panelEncargada").hidden = false;
}


/* =========================================
   INICIAR SESIÓN
========================================= */

$("formLogin").addEventListener("submit", async e => {

    e.preventDefault();

    if (!esConfiguracionLista) {
        msg("loginMsg", "Revisa la configuración de Firebase.", true);
        return;
    }

    const correo = $("correo").value.trim();
    const contrasena = $("contrasena").value;

    if (!correo || !contrasena) {
        msg("loginMsg", "Completa el correo y la contraseña.", true);
        return;
    }

    try {

        msg("loginMsg", "Verificando acceso...");

        const cred = await auth.signInWithEmailAndPassword(
            correo,
            contrasena
        );

        if (!autorizado(cred.user)) {

            await auth.signOut();

            msg(
                "loginMsg",
                "Esta cuenta no está autorizada como encargada.",
                true
            );

            return;
        }

        mostrarPanel();
        escucharAdmin();

        msg("loginMsg", "");

    } catch (error) {

        console.error("Error de inicio de sesión:", error);

        const errores = {
            "auth/user-not-found": "No existe una cuenta con ese correo.",
            "auth/wrong-password": "La contraseña es incorrecta.",
            "auth/invalid-credential": "El correo o la contraseña son incorrectos.",
            "auth/invalid-email": "El correo electrónico no es válido.",
            "auth/too-many-requests": "Demasiados intentos. Intenta más tarde.",
            "auth/network-request-failed": "Revisa tu conexión a internet.",
            "auth/operation-not-allowed": "Activa Correo/Contraseña en Firebase."
        };

        msg(
            "loginMsg",
            errores[error.code] || "Error: " + error.code,
            true
        );
    }
});


/* =========================================
   CERRAR SESIÓN
========================================= */

$("cerrarSesion").addEventListener("click", async () => {

    detenerEscuchas();

    try {

        await auth.signOut();

        $("formLogin").reset();

        mostrarLogin();

    } catch (error) {

        console.error(error);

        alert("No se pudo cerrar la sesión.");
    }
});


/* =========================================
   COMPROBAR SESIÓN AUTOMÁTICAMENTE
========================================= */

auth.onAuthStateChanged(user => {

    if (user && autorizado(user)) {

        mostrarPanel();
        escucharAdmin();

    } else {

        detenerEscuchas();
        mostrarLogin();
    }
});


/* =========================================
   ESCUCHAR CAMBIOS DE FIREBASE
========================================= */

function escucharAdmin() {

    if (adminIniciado) return;

    adminIniciado = true;

    // ESCUCHAR MENÚ

    stopMenu = db.collection("menu").onSnapshot(snapshot => {

        const platillos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderAdminMenu(platillos);

    }, error => {

        console.error("Error del menú:", error);

        $("adminMenu").textContent =
            "No se pudo cargar el menú.";
    });


    // ESCUCHAR PEDIDOS

    stopPedidos = db.collection("pedidos").onSnapshot(snapshot => {

        const pedidos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        pedidos.sort((a, b) =>
            obtenerTiempo(b.fecha) - obtenerTiempo(a.fecha)
        );

        renderPedidos(pedidos);

    }, error => {

        console.error("Error de pedidos:", error);

        $("adminPedidos").textContent =
            "No se pudieron cargar los pedidos.";
    });
}


/* =========================================
   OBTENER FECHA EN MILISEGUNDOS
========================================= */

function obtenerTiempo(fecha) {

    if (!fecha) return 0;

    if (typeof fecha.toMillis === "function") {
        return fecha.toMillis();
    }

    if (fecha.seconds !== undefined) {
        return fecha.seconds * 1000;
    }

    if (fecha instanceof Date) {
        return fecha.getTime();
    }

    return 0;
}


/* =========================================
   MOSTRAR FECHA Y HORA
========================================= */

function mostrarFecha(fecha) {

    if (!fecha) return "Registrando...";

    let fechaReal;

    if (typeof fecha.toDate === "function") {
        fechaReal = fecha.toDate();

    } else if (fecha instanceof Date) {
        fechaReal = fecha;

    } else {
        return "Registrando...";
    }

    return fechaReal.toLocaleString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}


/* =========================================
   MOSTRAR PLATILLOS
========================================= */

function renderAdminMenu(platillos) {

    const contenedor = $("adminMenu");

    if (!platillos.length) {

        contenedor.innerHTML =
            "<p class='muted'>Todavía no hay platillos registrados.</p>";

        return;
    }

    contenedor.innerHTML = platillos.map(p => `

        <article class="fila-admin">

            <div style="display:flex;align-items:center;gap:12px">

                ${p.imagen ? `

                    <img
                        src="${escapar(p.imagen)}"
                        alt="${escapar(p.nombre)}"
                        style="width:75px;height:65px;object-fit:cover;border-radius:10px"
                    >

                ` : `

                    <div style="width:75px;height:65px;background:#edf3ef;
                    display:grid;place-items:center;border-radius:10px">
                        🍽️
                    </div>

                `}

                <div>

                    <b>${escapar(p.nombre)}</b>

                    <br>

                    <span>${dinero(p.precio)}</span>

                    <br>

                    <small>
                        ${p.activo ? "Disponible" : "No disponible"}
                    </small>

                </div>

            </div>

            <div style="display:flex;gap:7px;flex-wrap:wrap">

                <button
                    type="button"
                    class="boton secundario"
                    data-edit="${p.id}">
                    ✏️ Editar
                </button>

                <button
                    type="button"
                    class="mini-boton"
                    data-del="${p.id}">
                    🗑️ Eliminar
                </button>

            </div>

        </article>

    `).join("");


    // BOTÓN EDITAR

    contenedor.querySelectorAll("[data-edit]").forEach(boton => {

        boton.onclick = () => {

            const platillo = platillos.find(
                p => p.id === boton.dataset.edit
            );

            if (platillo) editarPlatillo(platillo);
        };
    });


    // BOTÓN ELIMINAR

    contenedor.querySelectorAll("[data-del]").forEach(boton => {

        boton.onclick = async () => {

            if (!confirm("¿Deseas eliminar este platillo?")) {
                return;
            }

            try {

                await db.collection("menu")
                    .doc(boton.dataset.del)
                    .delete();

                alert("Platillo eliminado correctamente.");

            } catch (error) {

                console.error(error);

                alert("No se pudo eliminar el platillo.");
            }
        };
    });
}


/* =========================================
   EDITAR PLATILLO
========================================= */

function editarPlatillo(p) {

    $("platilloId").value = p.id;
    $("nombrePlatillo").value = p.nombre || "";
    $("precio").value = p.precio || "";
    $("descripcion").value = p.descripcion || "";
    $("imagen").value = p.imagen || "";
    $("activo").value = String(p.activo !== false);

    $("guardarPlatillo").textContent = "Actualizar platillo";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================================
   LIMPIAR FORMULARIO
========================================= */

function limpiarFormulario() {

    $("formPlatillo").reset();

    $("platilloId").value = "";

    $("activo").value = "true";

    $("guardarPlatillo").textContent = "Guardar platillo";
}

$("cancelarEdicion").addEventListener("click", limpiarFormulario);


/* =========================================
   AGREGAR O ACTUALIZAR PLATILLO
========================================= */

$("formPlatillo").addEventListener("submit", async e => {

    e.preventDefault();

    const id = $("platilloId").value;

    const nombre = $("nombrePlatillo").value.trim();

    const precio = Number($("precio").value);

    const descripcion = $("descripcion").value.trim();

    const imagen = $("imagen").value.trim();

    const activo = $("activo").value === "true";


    if (nombre.length < 2 || nombre.length > 80) {

        msg("menuMsg", "Escribe un nombre válido.", true);

        return;
    }

    if (!Number.isFinite(precio) || precio <= 0 || precio > 9999) {

        msg("menuMsg", "Escribe un precio válido.", true);

        return;
    }

    if (imagen && !/^https:\/\/.+/i.test(imagen)) {

        msg("menuMsg", "La imagen debe tener una dirección HTTPS.", true);

        return;
    }


    const datos = {

        nombre,
        precio,
        descripcion,
        imagen,
        activo,

        actualizado: firebase.firestore.FieldValue.serverTimestamp()
    };


    try {

        if (id) {

            await db.collection("menu")
                .doc(id)
                .update(datos);

            msg("menuMsg", "¡Platillo actualizado correctamente!");

        } else {

            datos.creado =
                firebase.firestore.FieldValue.serverTimestamp();

            await db.collection("menu").add(datos);

            msg("menuMsg", "¡Nuevo platillo agregado correctamente!");
        }

        limpiarFormulario();

    } catch (error) {

        console.error("Error al guardar platillo:", error);

        msg("menuMsg", "No se pudo guardar. Revisa los permisos de Firebase.", true);
    }
});


/* =========================================
   MOSTRAR PEDIDOS
========================================= */

function renderPedidos(pedidos) {

    $("contadorPedidos").textContent =
        `${pedidos.length} pedidos`;


    if (!pedidos.length) {

        $("adminPedidos").innerHTML =
            "<p class='muted'>Todavía no hay pedidos.</p>";

        return;
    }


    $("adminPedidos").innerHTML = pedidos.map(p => {

        const puedeEliminar =
            p.estadoActualizadoPorEncargada === true ||
            (p.estado && p.estado !== "Recibido");


        return `

            <article class="pedido">

                <div class="pedido-detalle">

                    <b>${escapar(p.alumno || "Alumno")}</b>

                    · ${escapar(p.grupo || "")}

                    · ${escapar(p.semestre || "")}

                    <small>

                        <br>

                        Folio: ${escapar(p.id)}

                        <br>

                        ${(p.items || []).map(i =>
                            `${escapar(i.nombre)} × ${i.cantidad}`
                        ).join(", ")}

                        <br>

                        Total: ${dinero(p.total)}

                        · Pago: ${escapar(p.metodoPago || "")}

                        <br>

                        Estado del pago:
                        ${escapar(p.pagoEstado || "Pendiente")}

                        <br>

                        Fecha y hora:
                        ${mostrarFecha(p.fecha)}

                    </small>

                </div>


                <div class="pedido-acciones">

                    <span class="estado ${
                        p.estado === "Cancelado" ? "cancelado" :
                        p.estado === "Finalizado" ? "finalizado" : ""
                    }">

                        ${escapar(p.estado || "Recibido")}

                    </span>


                    <select data-status="${p.id}">

                        <option value="">Cambiar estado</option>

                        <option value="Recibido">Recibido</option>

                        <option value="En preparación">En preparación</option>

                        <option value="Finalizado">Finalizado</option>

                        <option value="Cancelado">Cancelado</option>

                    </select>


                    ${puedeEliminar ? `

                        <button
                            type="button"
                            class="mini-boton"
                            data-delete="${p.id}">

                            🗑️ Eliminar pedido

                        </button>

                    ` : `

                        <small class="muted">
                            Cambia el estado para habilitar la eliminación.
                        </small>

                    `}

                </div>

            </article>

        `;

    }).join("");


    /* =====================================
       CAMBIAR ESTADO DEL PEDIDO
    ===================================== */

    $("adminPedidos")
        .querySelectorAll("[data-status]")
        .forEach(select => {

            select.onchange = async () => {

                if (!select.value) return;

                const nuevoEstado = select.value;

                try {

                    await db.collection("pedidos")
                        .doc(select.dataset.status)
                        .update({

                            estado: nuevoEstado,

                            estadoActualizadoPorEncargada: true,

                            actualizado:
                                firebase.firestore.FieldValue.serverTimestamp()
                        });

                    alert("Estado del pedido actualizado.");

                } catch (error) {

                    console.error(error);

                    alert("No se pudo actualizar el pedido.");
                }

                select.value = "";
            };
        });


    /* =====================================
       ELIMINAR PEDIDO
    ===================================== */

    $("adminPedidos")
        .querySelectorAll("[data-delete]")
        .forEach(boton => {

            boton.onclick = async () => {

                const id = boton.dataset.delete;

                const confirmar = confirm(
                    "¿Deseas eliminar definitivamente este pedido? También desaparecerá del historial del alumno."
                );

                if (!confirmar) return;

                try {

                    await db.collection("pedidos")
                        .doc(id)
                        .delete();

                    alert("Pedido eliminado correctamente.");

                } catch (error) {

                    console.error(error);

                    alert("No se pudo eliminar el pedido. Revisa las reglas de Firebase.");
                }
            };
        });

}


/* =========================================
   FIN DEL PANEL DE ENCARGADA
========================================= */

console.log("Panel de encargada cargado correctamente.");
