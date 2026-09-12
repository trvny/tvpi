(() => {
  const toggle = document.getElementById("trvny-nav-toggle");
  const drawer = document.getElementById("trvny-nav-drawer");
  const backdrop = document.getElementById("trvny-nav-backdrop");
  const closeButton = document.getElementById("trvny-nav-close");
  if (!toggle || !drawer || !backdrop || !closeButton) return;

  let previousFocus = null;
  const links = [...drawer.querySelectorAll("a, button")];

  function openDrawer() {
    previousFocus = document.activeElement;
    drawer.dataset.open = "true";
    drawer.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    backdrop.hidden = false;
    document.body.classList.add("trvny-nav-locked");
    closeButton.focus();
  }

  function closeDrawer() {
    drawer.dataset.open = "false";
    drawer.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    backdrop.hidden = true;
    document.body.classList.remove("trvny-nav-locked");
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }

  toggle.addEventListener("click", openDrawer);
  closeButton.addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (event) => {
    if (drawer.dataset.open !== "true") return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== "Tab" || links.length === 0) return;
    const first = links[0];
    const last = links[links.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
})();
