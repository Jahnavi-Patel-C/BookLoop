import { Link } from 'react-router-dom';
import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__inner">
          <div className="footer__brand">
            <div className="footer__brand-name">
              Book<em>Loop</em>
            </div>
            <p className="footer__tagline">
              A book shared is a story continued. Join your local reading
              community and keep great stories circulating.
            </p>
          </div>

          <div className="footer__nav">
            <h4 className="footer__heading">Navigate</h4>
            <ul className="footer__links">
              <li><Link to="/" className="footer__link">Home</Link></li>
              <li><Link to="/explore" className="footer__link">Explore Books</Link></li>
              <li><Link to="/add" className="footer__link">Add a Book</Link></li>
            </ul>
          </div>

          <div className="footer__nav">
            <h4 className="footer__heading">Circulation</h4>
            <ul className="footer__links">
              <li><Link to="/circulation" className="footer__link">Chronicle</Link></li>
              <li><Link to="/lending" className="footer__link">Lending Desk</Link></li>
              <li><Link to="/borrowings" className="footer__link">My Borrowings</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <span>&copy; {new Date().getFullYear()} BookLoop. Built for readers, by readers.</span>
          <span>A community-driven book circulation platform.</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

