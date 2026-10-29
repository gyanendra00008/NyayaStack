import { Link } from 'react-router-dom'
import bg from '../assets/bg.jpeg'
import logo from '../assets/logo.png'

function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fbf3e2] text-[#3b2a20]">
      {/* Navbar */}
      <nav className="grid grid-cols-[1fr_auto_1fr] items-center w-full px-3 sm:px-6 md:px-12 py-3 bg-[#fdf8ec]/90 backdrop-blur border-b border-[#e6d7b8] sticky top-0 z-10">
        {/* Left: brand */}
        <div className="flex items-center gap-2 justify-self-start">
          <img
            src={logo}
            alt="NyayaStack"
            className="h-9 w-9 object-contain mix-blend-multiply"
          />
          <span className="text-lg sm:text-xl font-bold text-[#7a1620] font-serif">
            NyayaStack
          </span>
        </div>

        {/* Center: links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium justify-self-center">
          <a href="#home" className="text-[#7a1620]">Home</a>
          <a href="#about" className="hover:text-[#7a1620] transition">About</a>
          <a href="#features" className="hover:text-[#7a1620] transition">Features</a>
          <a href="#statistics" className="hover:text-[#7a1620] transition">Statistics</a>
        </div>

        {/* Right: buttons */}
        <div className="flex items-center gap-2 sm:gap-3 justify-self-end col-start-3">
          <Link
            to="/admin-login"
            className="hidden lg:inline text-xs font-semibold text-stone-600 hover:text-[#7a1620] hover:underline mr-1"
          >
            Admin Login
          </Link>
          <Link
            to="/authority-login"
            className="hidden md:inline text-sm font-medium text-[#7a1620] hover:underline mr-1"
          >
            Authority Login
          </Link>
          <Link
            to="/login"
            className="px-3 sm:px-4 py-1.5 rounded-md border border-[#7a1620] text-[#7a1620] text-sm font-medium hover:bg-[#7a1620] hover:text-white transition"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="px-3 sm:px-4 py-1.5 rounded-md bg-[#7a1620] text-white text-sm font-medium hover:bg-[#5e1018] transition whitespace-nowrap"
          >
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        id="home"
        className="flex-1 flex items-center justify-center text-center px-4 py-10 md:py-12 bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      >
        <div className="max-w-3xl flex flex-col items-center">
          <img
            src={logo}
            alt="NyayaStack logo"
            className="h-32 sm:h-40 md:h-52 object-contain mix-blend-multiply"
          />

          <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-bold text-[#7a1620] font-serif">
            NyayaStack
          </h1>
          <p className="mt-1 tracking-[0.2em] sm:tracking-[0.3em] text-[10px] sm:text-xs md:text-sm text-[#7a1620] font-semibold">
            SPEAK ✦ REPORT ✦ REDRESS
          </p>

          <h2 className="mt-6 md:mt-8 text-xl sm:text-2xl md:text-3xl font-bold font-serif">
            A Safe, Transparent and Accountable Grievance Redressal Portal
          </h2>
          <p className="mt-4 text-base sm:text-lg">File complaints, track status, stay informed.</p>
          <p className="font-semibold">Your voice matters.</p>

          <div className="mt-8 flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 w-full sm:w-auto">
            <Link
              to="/file-complaint"
              className="px-6 py-3 rounded-md bg-[#7a1620] text-white font-semibold hover:bg-[#5e1018] transition"
            >
              File a Complaint
            </Link>
            <Link
              to="/publictrans"
              className="px-6 py-3 rounded-md border border-[#7a1620] bg-white/70 text-[#7a1620] font-semibold hover:bg-white transition"
            >
              View Public Dashboard
            </Link>
          </div>

          <p className="mt-6 text-sm">
            Are you an authority?{' '}
            <Link to="/authority-login" className="font-semibold text-[#7a1620] hover:underline">
              Authority Login
            </Link>
          </p>

          <p className="mt-2 text-xs text-stone-500">
            System Administrator?{' '}
            <Link to="/admin-login" className="font-semibold text-[#7a1620] hover:underline">
              Admin Login
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}

export default Home