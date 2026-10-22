export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 mb-4">
        NyayaStack Fullstack Setup
      </span>
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-gray-900 mb-4">
        Legal Tech Platform Architecture
      </h1>
      <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
        Frontend configured with React 19, Vite, Tailwind CSS, Redux Toolkit, and React Router.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
          <h3 className="font-semibold text-gray-900 mb-1">State Management</h3>
          <p className="text-sm text-gray-500">Redux Toolkit configured with prebuilt auth slices and custom hooks.</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
          <h3 className="font-semibold text-gray-900 mb-1">API Client</h3>
          <p className="text-sm text-gray-500">Axios instance configured with base URL, token interceptors, and error handling.</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
          <h3 className="font-semibold text-gray-900 mb-1">Routing</h3>
          <p className="text-sm text-gray-500">React Router v7 setup with layouts, page routes, and 404 fallbacks.</p>
        </div>
      </div>
    </div>
  );
}
