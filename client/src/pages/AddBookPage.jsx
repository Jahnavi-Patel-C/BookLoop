import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createBook, searchBookMetadata } from '../services/bookService';
import './AddBookPage.css';

const GENRES = [
  'Fiction', 'Non-Fiction', 'Mystery', 'Science Fiction', 'Fantasy',
  'Romance', 'Thriller', 'Biography', 'History', 'Self-Help',
  'Science', 'Philosophy', 'Poetry', 'Drama', 'Children',
  'Young Adult', 'Horror', 'Travel', 'Cooking', 'Art', 'Other',
];

const initialForm = {
  title: '',
  author: '',
  genre: '',
  description: '',
  coverImage: '',
  availability: true,
};

function AddBookPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  // Google Books lookup state
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [autofillNotice, setAutofillNotice] = useState('');

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Book title is required';
    if (!form.author.trim()) errs.author = 'Author name is required';
    if (!form.genre) errs.genre = 'Please select a genre';
    if (form.title.length > 200) errs.title = 'Title cannot exceed 200 characters';
    if (form.author.length > 100) errs.author = 'Author name cannot exceed 100 characters';
    if (form.description.length > 2000) errs.description = 'Description cannot exceed 2000 characters';
    if (form.coverImage.trim()) {
      try {
        new URL(form.coverImage);
      } catch {
        errs.coverImage = 'Please enter a valid URL';
      }
    }
    return errs;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Book catalogue search handler (Open Library)
  const handleCatalogueLookup = async (e) => {
    if (e) e.preventDefault();
    setLookupError('');
    setAutofillNotice('');

    const query = lookupQuery.trim();
    if (!query) {
      setLookupError('Please enter a title, author, or ISBN to search');
      return;
    }

    setIsSearching(true);
    try {
      const res = await searchBookMetadata(query);
      if (res.data && res.data.length > 0) {
        setLookupResults(res.data);
      } else {
        setLookupResults([]);
        setLookupError('No matching editions found in Open Library. You can enter details manually below.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Could not connect to book catalogue.';
      setLookupError(msg);
      setLookupResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Populate form with selected edition
  const handleSelectBook = (book) => {
    setForm({
      title: book.title || '',
      author: book.author || '',
      genre: book.genre || 'Other',
      description: book.description || '',
      coverImage: book.coverImage || '',
      availability: true,
    });

    setErrors({});
    setLookupResults([]);
    setAutofillNotice(`Details for "${book.title}" auto-filled from Open Library. You may review and edit any field below before listing.`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSuccess(false);

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        ownerName: user?.name || 'Anonymous',
        ownerNeighborhood: user?.neighborhood || '',
      };
      const result = await createBook(payload);
      setSuccess(true);
      setForm(initialForm);
      setErrors({});
      setAutofillNotice('');
      // Navigate to the new book's detail page after a brief moment
      setTimeout(() => {
        navigate(`/books/${result.data._id}`);
      }, 1500);
    } catch (err) {
      const message =
        err.response?.data?.messages?.join(', ') ||
        err.response?.data?.error ||
        err.message ||
        'Failed to add book. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="add-book-page">
      <div className="container">
        <div className="add-book__header">
          <span className="section-eyebrow">Circulation Catalogue</span>
          <h1 className="add-book__title">Share a Book</h1>
          <p className="add-book__subtitle">
            Add a book you'd like to share with fellow community readers.
          </p>
        </div>

        {success && (
          <div className="alert alert--success" style={{ maxWidth: 660, margin: '0 auto var(--space-lg)' }}>
            Book added successfully! Redirecting to book record...
          </div>
        )}

        {submitError && (
          <div className="alert alert--error" style={{ maxWidth: 660, margin: '0 auto var(--space-lg)' }}>
            {submitError}
          </div>
        )}

        {/* Book Catalogue Lookup Section */}
        <div className="add-book__lookup-card">
          <div className="lookup-card__header">
            <span className="lookup-card__badge">Smart Auto-fill</span>
            <h3 className="lookup-card__title">Search Open Library Catalogue</h3>
            <p className="lookup-card__subtitle">
              Enter an ISBN (e.g. 9780141439518) or book title to automatically fetch publication metadata and cover art.
            </p>
          </div>

          <form className="lookup-card__search-bar" onSubmit={handleCatalogueLookup}>
            <input
              type="text"
              className="form-input lookup-card__input"
              placeholder="Search by title, author, or ISBN..."
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn--primary lookup-card__btn"
              disabled={isSearching}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
            {lookupResults.length > 0 && (
              <button
                type="button"
                className="btn btn--secondary lookup-card__btn-clear"
                onClick={() => setLookupResults([])}
              >
                Clear
              </button>
            )}
          </form>

          {lookupError && (
            <div className="lookup-card__error-msg">
              {lookupError}
            </div>
          )}

          {/* Results Dropdown / Grid */}
          {lookupResults.length > 0 && (
            <div className="lookup-card__results">
              <div className="lookup-card__results-header">
                <span>Select an edition to auto-fill ({lookupResults.length} found):</span>
              </div>
              <div className="lookup-card__results-list">
                {lookupResults.map((item) => (
                  <div
                    key={item.googleBookId}
                    className="lookup-card__item"
                    onClick={() => handleSelectBook(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectBook(item);
                      }
                    }}
                  >
                    <div className="lookup-card__thumb-wrap">
                      {item.coverImage ? (
                        <img
                          src={item.coverImage}
                          alt={item.title}
                          className="lookup-card__thumb"
                          loading="lazy"
                        />
                      ) : (
                        <div className="lookup-card__thumb-fallback">
                          <span>{item.genre}</span>
                        </div>
                      )}
                    </div>
                    <div className="lookup-card__item-info">
                      <h4 className="lookup-card__item-title">{item.title}</h4>
                      <p className="lookup-card__item-author">by {item.author}</p>
                      <div className="lookup-card__item-tags">
                        <span className="badge badge--genre">{item.genre}</span>
                        {item.publishedDate && (
                          <span className="lookup-card__item-meta">
                            {item.publishedDate.slice(0, 4)}
                          </span>
                        )}
                        {item.isbn && (
                          <span className="lookup-card__item-meta">
                            ISBN: {item.isbn}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn lookup-card__use-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectBook(item);
                      }}
                    >
                      Auto-fill
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {autofillNotice && (
          <div className="alert alert--info" style={{ maxWidth: 660, margin: '0 auto var(--space-md)', backgroundColor: 'var(--color-ivory)', border: '1px solid var(--color-royal-blue)', color: 'var(--color-royal-blue)' }}>
            {autofillNotice}
          </div>
        )}

        {/* Existing Share a Book Form */}
        <form className="add-book__form" onSubmit={handleSubmit} noValidate>
          <div className="add-book__row">
            <div className="form-group">
              <label className="form-label form-label--required" htmlFor="title">
                Book Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                className={`form-input ${errors.title ? 'form-input--error' : ''}`}
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. To Kill a Mockingbird"
              />
              {errors.title && <p className="form-error">{errors.title}</p>}
            </div>

            <div className="form-group">
              <label className="form-label form-label--required" htmlFor="author">
                Author
              </label>
              <input
                id="author"
                name="author"
                type="text"
                className={`form-input ${errors.author ? 'form-input--error' : ''}`}
                value={form.author}
                onChange={handleChange}
                placeholder="e.g. Harper Lee"
              />
              {errors.author && <p className="form-error">{errors.author}</p>}
            </div>
          </div>

          <div className="add-book__row">
            <div className="form-group">
              <label className="form-label form-label--required" htmlFor="genre">
                Genre
              </label>
              <select
                id="genre"
                name="genre"
                className={`form-select ${errors.genre ? 'form-select--error' : ''}`}
                value={form.genre}
                onChange={handleChange}
              >
                <option value="">Select a genre</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              {errors.genre && <p className="form-error">{errors.genre}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="ownerDisplay">
                Listing As (Book Owner)
              </label>
              <input
                id="ownerDisplay"
                type="text"
                className="form-input"
                value={user ? `${user.name} (${user.email})` : 'Loading...'}
                disabled
                readOnly
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>
                Your verified library account will be recorded as the owner.
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              className={`form-textarea ${errors.description ? 'form-textarea--error' : ''}`}
              value={form.description}
              onChange={handleChange}
              placeholder="Tell readers what this book is about..."
              rows="4"
            />
            {errors.description && <p className="form-error">{errors.description}</p>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="coverImage">
              Cover Image URL
            </label>
            <div className="cover-input-wrap">
              <input
                id="coverImage"
                name="coverImage"
                type="url"
                className={`form-input ${errors.coverImage ? 'form-input--error' : ''}`}
                value={form.coverImage}
                onChange={handleChange}
                placeholder="https://example.com/book-cover.jpg"
              />
              {form.coverImage && (
                <div className="cover-thumbnail-preview">
                  <img
                    src={form.coverImage}
                    alt="Cover preview"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <span>Cover Preview</span>
                </div>
              )}
            </div>
            {errors.coverImage && <p className="form-error">{errors.coverImage}</p>}
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                name="availability"
                type="checkbox"
                checked={form.availability}
                onChange={handleChange}
              />
              This book is currently available for sharing
            </label>
            <p style={{ marginTop: '6px', fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
              📍 <strong>Listing Location:</strong>{' '}
              {user?.neighborhood ? (
                <span>Shelved in <strong>{user.neighborhood}, Bengaluru</strong></span>
              ) : (
                <span>Bengaluru (You can set your neighbourhood in your <a href="/profile" style={{ color: 'var(--color-royal-blue)' }}>Profile</a> for local reader discovery).</span>
              )}
            </p>
          </div>

          <div className="add-book__actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting}
            >
              {submitting ? 'Adding Book...' : 'Add Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddBookPage;
