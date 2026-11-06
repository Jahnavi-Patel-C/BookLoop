import './Loader.css';

function Loader({ message = 'Loading...' }) {
  return (
    <div className="loader">
      <div className="loader__spinner">
        <div className="loader__dot"></div>
        <div className="loader__dot"></div>
        <div className="loader__dot"></div>
      </div>
      <p className="loader__message">{message}</p>
    </div>
  );
}

export default Loader;

