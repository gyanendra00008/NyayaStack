export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} NyayaStack. All rights reserved.
      </div>
    </footer>
  );
}
