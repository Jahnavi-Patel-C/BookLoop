import './GenreFilter.css';

const GENRES = [
  'All',
  'Fiction',
  'Non-Fiction',
  'Mystery',
  'Science Fiction',
  'Fantasy',
  'Romance',
  'Thriller',
  'Biography',
  'History',
  'Self-Help',
  'Science',
  'Philosophy',
  'Poetry',
  'Drama',
  'Children',
  'Young Adult',
  'Horror',
  'Travel',
  'Cooking',
  'Art',
  'Other',
];

function GenreFilter({ selected, onChange }) {
  return (
    <div className="genre-filter">
      <div className="genre-filter__label">Filter by Genre:</div>
      <div className="genre-filter__group">
        {GENRES.map((genre) => {
          const isActive = (genre === 'All' && !selected) || selected === genre;
          return (
            <button
              key={genre}
              type="button"
              className={`btn genre-filter__btn ${isActive ? 'genre-filter__btn--active' : ''}`}
              onClick={() => onChange(genre === 'All' ? '' : genre)}
              aria-pressed={isActive}
            >
              {genre}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default GenreFilter;
