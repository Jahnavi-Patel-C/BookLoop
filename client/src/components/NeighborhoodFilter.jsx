import { NEIGHBORHOODS } from '../constants/neighborhoods';
import './NeighborhoodFilter.css';

function NeighborhoodFilter({ selected, onChange, userNeighborhood }) {
  const activePriority = selected || userNeighborhood;

  return (
    <div className="neighborhood-filter">
      <div className="neighborhood-filter__header">
        <div className="neighborhood-filter__label">
          <span>📍 Discover by Bengaluru Neighbourhood</span>
        </div>
        {activePriority && (
          <div className="neighborhood-filter__hint">
            Prioritising <strong>{activePriority}</strong> & nearby areas — City-wide circulation preserved
          </div>
        )}
      </div>

      <div className="neighborhood-filter__group">
        <select
          className="neighborhood-filter__select"
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Prioritise books by Bengaluru neighbourhood"
        >
          <option value="">
            {userNeighborhood
              ? `All Bengaluru (Prioritising your area: ${userNeighborhood})`
              : 'All Bengaluru (Standard newest order)'}
          </option>
          {NEIGHBORHOODS.map((nh) => (
            <option key={nh} value={nh}>
              {nh} {userNeighborhood === nh ? '★ (Your neighbourhood)' : ''}
            </option>
          ))}
        </select>

        {selected && (
          <button
            type="button"
            className="neighborhood-filter__reset-btn"
            onClick={() => onChange('')}
          >
            Reset to All Bengaluru
          </button>
        )}
      </div>
    </div>
  );
}

export default NeighborhoodFilter;
