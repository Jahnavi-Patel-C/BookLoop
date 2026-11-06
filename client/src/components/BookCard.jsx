import { Link } from 'react-router-dom';
import './BookCard.css';

function BookCard({ book }) {
  const { _id, title, author, genre, coverImage, availability, ownerName, ownerNeighborhood } = book;

  return (
    <article className="book-card">
      <div className="book-card__cover">
        {coverImage ? (
          <img src={coverImage} alt={`Cover of ${title}`} loading="lazy" />
        ) : (
          <div className="book-card__cover-specimen">
            <span className="book-card__specimen-genre">{genre}</span>
            <h4 className="book-card__specimen-title">{title}</h4>
            <div className="book-card__specimen-rule"></div>
            <p className="book-card__specimen-author">{author}</p>
          </div>
        )}
        <div className="book-card__badge-wrap">
          <span className={`badge ${availability ? 'badge--available' : 'badge--unavailable'}`}>
            {availability ? 'Available' : 'Shared'}
          </span>
        </div>
      </div>

      <div className="book-card__body">
        <div className="book-card__meta">
          <span className="book-card__genre">{genre}</span>
          <span className="book-card__owner">Shelved by {ownerName}</span>
        </div>

        <h3 className="book-card__title">
          <Link to={`/books/${_id}`}>{title}</Link>
        </h3>
        <p className="book-card__author">by {author}</p>

        <div className={`book-card__location-badge ${ownerNeighborhood ? 'book-card__location-badge--confirmed' : ''}`} title="Physical collection location specified by owner">
          <span>📍</span>
          <span>
            {ownerNeighborhood ? `${ownerNeighborhood}, Bengaluru` : 'Bengaluru (Location unconfirmed)'}
          </span>
        </div>

        <div className="book-card__footer">
          <Link to={`/books/${_id}`} className="btn book-card__btn">
            View Details
          </Link>
        </div>
      </div>
    </article>
  );
}

export default BookCard;
