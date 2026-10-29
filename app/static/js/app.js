document.addEventListener("alpine:init", () => {
  Alpine.data("layoutState", () => ({
    sidebarOpen: false,
    dark: localStorage.getItem("darkMode") === "true",
    toggleDark() {
      this.dark = !this.dark;
      localStorage.setItem("darkMode", this.dark);
      document.documentElement.classList.toggle("dark", this.dark);
    }
  }));
});

function livePatientSearch() {
  return {
    q: "",
    risk: "",
    patients: [],
    async search() {
      const params = new URLSearchParams({ q: this.q, risk: this.risk });
      const res = await fetch(`/api/patients?${params}`);
      this.patients = await res.json();
    }
  };
}
