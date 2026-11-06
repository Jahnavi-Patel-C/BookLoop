import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCard from '../components/BookCard';
import SearchBar from '../components/SearchBar';
import GenreFilter from '../components/GenreFilter';
import NeighborhoodFilter from '../components/NeighborhoodFilter';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { getBooks } from '../services/bookService';
import { useAuth } from '../context/AuthContext';
import './ExploreBooksPage.css';

function ExploreBooksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('');
  const [neighborhood, setNeighborhood] = useState('');

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (genre) params.genre = genre;
      if (neighborhood) params.neighborhood = neighborhood;
      const result = await getBooks(params);
      setBooks(result.data);
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || 'Failed to load books'
      );
    } finally {
      setLoading(false);
    }
  }, [search, genre, neighborhood]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchBooks();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchBooks]);

  return (
    <div className="explore-page">
      <div className="explore-page__header">
        <div className="container">
          <h1 className="explore-page__title">Explore Books</h1>
          <p className="explore-page__subtitle">
            Discover books shared by readers in your community.
          </p>

          <div className="explore-page__controls">
            <div className="explore-page__top-controls">
              <SearchBar value={search} onChange={setSearch} />
              {!loading && !error && (
                <span className="explore-page__count">
                  {books.length} {books.length === 1 ? 'book' : 'books'} found
                </span>
              )}
            </div>
            <GenreFilter selected={genre} onChange={setGenre} />
            <NeighborhoodFilter
              selected={neighborhood}
              onChange={setNeighborhood}
              userNeighborhood={user?.neighborhood}
            />
          </div>
        </div>
      </div>

      <div className="explore-page__body">
        <div className="container">
          {loading ? (
            <Loader message="Searching for books..." />
          ) : error ? (
            <ErrorState
              title="Could not load books"
              message={error}
              onRetry={fetchBooks}
            />
          ) : books.length === 0 ? (
            <EmptyState
              title="No books found"
              message={
                search || genre
                  ? 'No books match your search or genre filter. Try different keywords or browse all genres.'
                  : 'No books have been listed yet. Be the first to share one!'
              }
              actionLabel={search || genre ? undefined : 'Share a Book'}
              onAction={search || genre ? undefined : () => navigate('/add')}
            />
          ) : (
            <div className="explore-page__grid">
              {books.map((book) => (
                <BookCard key={book._id} book={book} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExploreBooksPage;

