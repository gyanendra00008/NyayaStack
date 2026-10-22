import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import store from './store/index.js';
import AppRoutes from './routes/AppRoutes.jsx';
import './App.css';

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Provider>
  );
}

export default App;
