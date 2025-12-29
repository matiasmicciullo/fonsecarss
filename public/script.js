// ----------------------- UTIL -----------------------
function $(id) {
  return document.getElementById(id);
}

// ----------------------- FRONTEND PÚBLICO -----------------------
let vehiculosCache = [];

if ($("vehiculos-grid")) {
  fetch("/api/vehiculos")
    .then(res => res.json())
    .then(data => {
      vehiculosCache = data.filter(v => v.estado !== "Vendido");
      renderVehiculos(vehiculosCache);
      initFiltros();
    })
    .catch(err => console.error("Error cargando vehículos:", err));
}


function renderVehiculos(vehiculos) {
  const grid = $("vehiculos-grid");
  if (!grid) return;

  grid.innerHTML = vehiculos.map(v => `
    <div class="vehiculo-card" onclick='abrirModal(${JSON.stringify(v)})'>
      <div class="carousel">
        <img src="${v.imagen1}" alt="${v.marca} ${v.modelo}">
        ${v.imagen2 ? `<img src="${v.imagen2}" alt="${v.marca} ${v.modelo}">` : ""}
        ${v.imagen3 ? `<img src="${v.imagen3}" alt="${v.marca} ${v.modelo}">` : ""}
      </div>

      <h3>${v.marca} ${v.modelo}</h3>
      <p class="precio">${v.precio}</p>
      <p class="estado ${v.estado.replace(/\s+/g, "-")}">${v.estado}</p>
    </div>
  `).join("");

  initCarruseles();
}

// ----------------------- ADMIN -----------------------
if ($("admin-vehiculos")) {
  fetch("/api/vehiculos")
    .then(res => res.json())
    .then(data => renderAdminList(data))
    .catch(err => console.error("Error admin:", err));
}

function renderAdminList(lista) {
  const adminList = $("admin-vehiculos");
  if (!adminList) return;

  adminList.innerHTML = lista.map(v => `
    <div class="admin-item">

      <div>
        <strong>${v.marca} ${v.modelo}</strong><br>
        ${v.precio} – ${v.estado}
      </div>

      <form action="/api/vehiculo/estado" method="POST">
        <input type="hidden" name="id" value="${v.id}">
        <select name="estado">
          <option value="Disponible" ${v.estado === "Disponible" ? "selected" : ""}>Disponible</option>
          <option value="En tratamiento" ${v.estado === "En tratamiento" ? "selected" : ""}>En tratamiento</option>
          <option value="Vendido" ${v.estado === "Vendido" ? "selected" : ""}>Vendido</option>
        </select>
        <button>Actualizar</button>
      </form>

      <form action="/api/vehiculo/eliminar" method="POST">
        <input type="hidden" name="id" value="${v.id}">
        <button>Eliminar</button>
      </form>

    </div>
  `).join("");
}

// ----------------------- CARRUSELES -----------------------
function initCarruseles() {
  document.querySelectorAll(".carousel").forEach(carousel => {
    const slides = carousel.querySelectorAll("img");
    let index = 0;

    if (slides.length <= 1) return;

    const prev = document.createElement("button");
    const next = document.createElement("button");

    prev.textContent = "❮";
    next.textContent = "❯";
    prev.className = "carousel-btn prev";
    next.className = "carousel-btn next";

    carousel.append(prev, next);

    function show(i) {
      slides.forEach((img, idx) => {
        img.style.display = idx === i ? "block" : "none";
      });
    }

    show(index);

    next.onclick = (e) => {
  e.stopPropagation(); // ⛔ evita abrir el modal
  index = (index + 1) % slides.length;
  show(index);
};

prev.onclick = (e) => {
  e.stopPropagation(); // ⛔ evita abrir el modal
  index = (index - 1 + slides.length) % slides.length;
  show(index);
};
});
}

// ----------------------- HOME CARRUSELES -----------------------
const homeUsados = document.getElementById("carousel-usados");
const home0Km = document.getElementById("carousel-0km");
const homeUtilitarios = document.getElementById("carousel-utilitarios");

if (homeUsados || home0Km || homeUtilitarios) {
  fetch("/api/vehiculos")
    .then(res => res.json())
    .then(vehiculos => {
      renderHome(homeUsados, vehiculos, "Usado");
      renderHome(home0Km, vehiculos, "0Km");
      renderHome(homeUtilitarios, vehiculos, "Utilitario");
    })
    .catch(err => console.error("Error home:", err));
}

function renderHome(container, vehiculos, categoria) {
  if (!container) return;

  const autos = vehiculos.filter(
    v => v.categoria === categoria && v.estado !== "Vendido"
  );

  if (autos.length === 0) {
    container.innerHTML = `
      <div class="slide">
        <p class="slide-desc">No hay vehículos disponibles</p>
      </div>
    `;
    return;
  }

  container.innerHTML = autos.map(v => `
    <div class="slide">
      <img src="${v.imagen1}" alt="${v.marca} ${v.modelo}" loading="lazy">
      <p class="slide-desc">
        ${v.marca} ${v.modelo} — ${v.precio}
      </p>
    </div>
  `).join("");

  initHomeCarousel(container.closest(".auto-carousel"));
}

function initHomeCarousel(carousel) {
  if (!carousel) return;

  const track = carousel.querySelector(".auto-carousel-track");
  const slides = track.querySelectorAll(".slide");
  const next = carousel.querySelector(".next");
  const prev = carousel.querySelector(".prev");

  let index = 0;

  function update() {
    track.style.transform = `translateX(-${index * 100}%)`;
  }

  update();

  // Flechas: solo mueven el carrusel
  next.onclick = (e) => {
    e.stopPropagation(); // ⛔ no redirige
    index = (index + 1) % slides.length;
    update();
  };

  prev.onclick = (e) => {
    e.stopPropagation(); // ⛔ no redirige
    index = (index - 1 + slides.length) % slides.length;
    update();
  };

  // Click en el carrusel → ir a vehículos
  carousel.addEventListener("click", () => {
    window.location.href = "vehiculos.html";
  });
}


const crearAdminBox = document.getElementById("crear-admin-box");

if (crearAdminBox) {
  fetch("/api/session")
    .then(res => res.json())
    .then(data => {
      if (!data.isSuperAdmin) {
  crearAdminBox.style.display = "none";
}
    })
    .catch(() => {
      crearAdminBox.style.display = "none";
    });
}

function initFiltros() {
  const botones = document.querySelectorAll(".filtro");

  botones.forEach(btn => {
    btn.addEventListener("click", () => {
      botones.forEach(b => b.classList.remove("activo"));
      btn.classList.add("activo");

      const categoria = btn.dataset.categoria;

      if (categoria === "Todos") {
        renderVehiculos(vehiculosCache);
      } else {
        const filtrados = vehiculosCache.filter(
          v => v.categoria === categoria
        );
        renderVehiculos(filtrados);
      }
    });
  });
}

function abrirModal(v) {
  const modal = document.getElementById("vehiculo-modal");
  const content = document.getElementById("modal-content");

  content.innerHTML = `
    <div class="modal-carousel">
      <img src="${v.imagen1}">
      ${v.imagen2 ? `<img src="${v.imagen2}">` : ""}
      ${v.imagen3 ? `<img src="${v.imagen3}">` : ""}
    </div>

    <h2>${v.marca} ${v.modelo}</h2>
    <p class="precio">${v.precio}</p>
    <p class="estado">${v.estado}</p>

    <h3>Ficha técnica</h3>
    <p>${v.ficha_tecnica || "Sin información adicional."}</p>
  `;

  modal.style.display = "flex";
}

document.addEventListener("click", e => {
  const modal = document.getElementById("vehiculo-modal");
  if (
    e.target.classList.contains("modal-overlay") ||
    e.target.classList.contains("modal-close")
  ) {
    modal.style.display = "none";
  }
});

// ----------------------- SESSION / ADMINS -----------------------
fetch("/api/session")
  .then(res => res.json())
  .then(data => {

    // Setear usuario en el form "Cambiar mi contraseña"
    const miUsuario = document.getElementById("mi-usuario");
    if (miUsuario) {
      miUsuario.value = data.usuario;
    }

    // Si es Fonsecars, cargar lista de admins
    if (data.usuario === "Fonsecars") {
      if (typeof cargarAdmins === "function") {
        cargarAdmins();
      }
    }
  })
  .catch(() => {
    // Si no hay sesión, no hacemos nada
  });

  function cargarAdmins() {
  fetch("/api/admins")
    .then(res => res.json())
    .then(admins => {
      const cont = document.getElementById("admin-lista");
      if (!cont) return;

      cont.innerHTML = admins.map(a => `
        <div class="admin-item">
          <strong>${a.usuario}</strong>

          <form action="/api/admin/password" method="POST">
            <input type="hidden" name="usuario" value="${a.usuario}">
            <input type="password" name="password" placeholder="Nueva contraseña" required>
            <button>Actualizar</button>
          </form>

          <form action="/api/admin/eliminar" method="POST">
            <input type="hidden" name="usuario" value="${a.usuario}">
            <button>Eliminar</button>
          </form>
        </div>
      `).join("");
    });
}

// ----------------------- NAV PANEL (solo admins) -----------------------
fetch("/api/session")
  .then(res => res.json())
  .then(data => {
    // Mostrar link Panel solo a admins
    const panelLink = document.getElementById("nav-panel");
    if (panelLink && data.usuario) {
      panelLink.style.display = "inline-block";
    }

    // Mostrar Cerrar sesión solo si hay sesión
    const logout = document.getElementById("nav-logout");
    if (logout && data.usuario) {
      logout.style.display = "block";
    }
  })
  .catch(() => {
    // No hay sesión → todo sigue oculto
  });

// ----------------------- CAMBIAR PASSWORD -----------------------
const formPassword = document.getElementById("form-password");

if (formPassword) {
  formPassword.addEventListener("submit", async (e) => {
    e.preventDefault();

    const errorBox = document.getElementById("password-error");
    errorBox.style.display = "none";

    const formData = new FormData(formPassword);

    const res = await fetch("/api/admin/password", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams(formData)
    });

    const data = await res.json();

    if (!res.ok) {
      errorBox.textContent = data.error;
      errorBox.style.display = "block";
      return;
    }

    alert("Contraseña actualizada correctamente");
    formPassword.reset();
  });
}

// ----------------------- HAMBURGER MENU -----------------------

document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");

  if (!hamburger || !navLinks) return;

  hamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    navLinks.classList.toggle("open");
  });

  // Cerrar menú al tocar un link
  navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
    });
  });
});


document.querySelectorAll("#nav-links a").forEach(link => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
  });
});

