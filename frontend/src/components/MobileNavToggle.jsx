export default function MobileNavToggle({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open menu"
      className="md:hidden mr-3 w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-stone-100 hover:bg-[#6B1724] hover:text-white transition"
    >
      <i className="fa-solid fa-bars"></i>
    </button>
  );
}