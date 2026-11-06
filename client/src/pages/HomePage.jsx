import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import BookCard from '../components/BookCard';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import { getBooks, getStats } from '../services/bookService';
import './HomePage.css';

function HomePage() {
  const [featuredBooks, setFeaturedBooks] = useState([]);
  const [stats, setStats] = useState({ totalBooks: 0, availableBooks: 0, sharedBooks: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [booksRes, statsRes] = await Promise.all([
          getBooks(),
          getStats(),
        ]);
        setFeaturedBooks(booksRes.data.slice(0, 4));
        setStats(statsRes.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="home-page">
      {/* Editorial Hero */}
      <section className="hero section--white">
        <div className="container hero__inner">
          <div className="hero__content">
            <span className="section-eyebrow">A Community-Driven Book Circulation Platform</span>
            <h1 className="hero__headline">
              Good books deserve to be read <em>more than once.</em>
            </h1>
            <p className="hero__text">
              Discover books sitting quietly on nearby bookshelves. Share the
              stories you have loved, borrow from neighbours, and keep the printed word
              circulating in your local community.
            </p>
            <div className="hero__actions">
              <Link to="/explore" className="btn hero__btn">
                Explore Books
              </Link>
              <Link to="/add" className="btn hero__btn">
                Share a Book
              </Link>
            </div>
          </div>

          <div className="hero__visual">
            <div className="hero__broadsheet">
              <div className="hero__broadsheet-header">
                <span className="hero__broadsheet-label">Librarian's Note</span>
                <span className="hero__broadsheet-date">Vol. 01 / Circulation</span>
              </div>
              <blockquote className="hero__broadsheet-quote">
                “A book is not a solitary object on a shelf. It is a conversation
                passed gently from one pair of hands to another.”
              </blockquote>
              <div className="hero__broadsheet-footer">
                <div className="hero__broadsheet-rule"></div>
                <div className="hero__broadsheet-meta">
                  <span className="hero__broadsheet-tag">Local Exchange</span>
                  <span className="hero__broadsheet-status">Open to All Readers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Community Introduction (Ivory Section) */}
      <section className="community section--ivory">
        <div className="container">
          <div className="community__header">
            <span className="section-eyebrow">The Philosophy</span>
            <h2 className="section-title">Why circulating books matters</h2>
            <p className="section-subtitle">
              Every home contains stories that have ceased moving. BookLoop turns stagnant shelves
              into an open, cooperative neighbourhood library.
            </p>
          </div>

          <div className="community__grid">
            <div className="community__column">
              <span className="community__num">01</span>
              <h3 className="community__title">Reviving Dormant Stories</h3>
              <p className="community__text">
                Titles that have already delivered their joy can awaken again in someone else’s hands.
                Every shared volume prolongs the life and relevance of the written work.
              </p>
            </div>

            <div className="community__column">
              <span className="community__num">02</span>
              <h3 className="community__title">Read Freely and Widely</h3>
              <p className="community__text">
                Explore without the constraint of purchasing every edition. Discover essays,
                memoirs, and novels you might otherwise have passed by in a bookstore.
              </p>
            </div>

            <div className="community__column">
              <span className="community__num">03</span>
              <h3 className="community__title">Local Connection</h3>
              <p className="community__text">
                Books become a quiet bridge between neighbours. Sharing stories strengthens
                communal knowledge and celebrates a shared love for deliberate reading.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works (White Section) */}
      <section className="how-it-works section--white" id="how-it-works">
        <div className="container">
          <div className="how-it-works__header">
            <span className="section-eyebrow">The Process</span>
            <h2 className="section-title">How BookLoop works</h2>
            <p className="section-subtitle">
              A transparent, three-step cycle designed to keep literature moving naturally through the community.
            </p>
          </div>

          <div className="how-it-works__timeline">
            <div className="how-it-works__card">
              <div className="how-it-works__step-num">Step I</div>
              <h3 className="how-it-works__card-title">List</h3>
              <p className="how-it-works__card-text">
                Catalogue books on your shelves that you are willing to circulate.
                Provide title, author, genre, and a personal note on the read.
              </p>
            </div>

            <div className="how-it-works__card">
              <div className="how-it-works__step-num">Step II</div>
              <h3 className="how-it-works__card-title">Discover</h3>
              <p className="how-it-works__card-text">
                Search the community catalogue by title, author, or genre.
                Inspect availability, book details, and owner descriptions.
              </p>
            </div>

            <div className="how-it-works__card">
              <div className="how-it-works__step-num">Step III</div>
              <h3 className="how-it-works__card-title">Circulate</h3>
              <p className="how-it-works__card-text">
                Connect with the book owner and arrange exchange. Structured borrowing
                tools and checkouts will expand in the next phase.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Community Highlights / Stats (Ivory Section) */}
      <section className="stats section--ivory">
        <div className="container">
          <div className="stats__header">
            <span className="section-eyebrow">Community Ledger</span>
            <h2 className="section-title">Circulation Statistics</h2>
          </div>

          <div className="stats__grid">
            <div className="stats__item">
              <div className="stats__number">{stats.totalBooks}</div>
              <div className="stats__label">Books Catalogued</div>
              <p className="stats__desc">Total titles registered across the collective community.</p>
            </div>
            <div className="stats__item">
              <div className="stats__number">{stats.availableBooks}</div>
              <div className="stats__label">Currently Available</div>
              <p className="stats__desc">Books ready to be borrowed immediately from neighbours.</p>
            </div>
            <div className="stats__item">
              <div className="stats__number">{stats.sharedBooks}</div>
              <div className="stats__label">In Active Circulation</div>
              <p className="stats__desc">Volumes presently being read and passed along.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Books (White Section) */}
      <section className="featured section--white">
        <div className="container">
          <div className="featured__header">
            <div>
              <span className="section-eyebrow">The Reading Room</span>
              <h2 className="section-title">Recently Listed Books</h2>
            </div>
            <Link to="/explore" className="btn featured__header-btn">
              Browse All Books
            </Link>
          </div>

          {loading ? (
            <Loader message="Loading books from the community shelf..." />
          ) : error ? (
            <p className="section-subtitle" style={{ color: '#b00020' }}>
              Could not load books. The database is reachable, but error occurred: {error}
            </p>
          ) : featuredBooks.length > 0 ? (
            <div className="featured__grid">
              {featuredBooks.map((book) => (
                <BookCard key={book._id} book={book} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="The shelf is currently empty"
              message="No books have been registered yet. Be the first reader to list a book from your collection."
              actionLabel="Share a Book"
              onAction={() => window.location.href = '/add'}
            />
          )}

          {featuredBooks.length > 0 && (
            <div className="featured__footer">
              <Link to="/explore" className="btn featured__footer-btn">
                Explore All Community Listings →
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default HomePage;
