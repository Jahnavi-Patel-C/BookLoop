/**
 * BookLoop Genuine Bengaluru Neighbourhoods & Adjacency Graph (Frontend)
 *
 * This list is extensible: new Bengaluru localities can be added directly
 * without altering UI or data architectures.
 */

export const NEIGHBORHOODS = [
  'Yelahanka',
  'Yelahanka New Town',
  'Hebbal',
  'Jakkur',
  'Sahakara Nagar',
  'Vidyaranyapura',
  'Thanisandra',
  'Hennur',
  'RT Nagar',
  'Malleshwaram',
  'Rajajinagar',
  'Vijayanagar',
  'Indiranagar',
  'Whitefield',
  'Koramangala',
  'Jayanagar',
  'JP Nagar',
  'Electronic City',
];

export const NEIGHBORHOOD_ADJACENCY = {
  // North Bengaluru
  'Yelahanka': ['Yelahanka New Town', 'Jakkur', 'Sahakara Nagar', 'Vidyaranyapura', 'Hebbal'],
  'Yelahanka New Town': ['Yelahanka', 'Vidyaranyapura', 'Sahakara Nagar', 'Jakkur'],
  'Jakkur': ['Yelahanka', 'Sahakara Nagar', 'Hebbal', 'Thanisandra'],
  'Sahakara Nagar': ['Yelahanka', 'Hebbal', 'Jakkur', 'Vidyaranyapura'],
  'Vidyaranyapura': ['Yelahanka', 'Yelahanka New Town', 'Sahakara Nagar', 'Hebbal'],
  'Hebbal': ['Sahakara Nagar', 'Jakkur', 'RT Nagar', 'Thanisandra', 'Yelahanka'],
  'Thanisandra': ['Hebbal', 'Jakkur', 'Hennur'],
  'Hennur': ['Thanisandra', 'Hebbal', 'RT Nagar', 'Indiranagar'],
  'RT Nagar': ['Hebbal', 'Malleshwaram', 'Hennur', 'Rajajinagar'],

  // Central & West Bengaluru
  'Malleshwaram': ['Rajajinagar', 'RT Nagar', 'Vijayanagar'],
  'Rajajinagar': ['Malleshwaram', 'Vijayanagar', 'RT Nagar'],
  'Vijayanagar': ['Rajajinagar', 'Malleshwaram', 'Jayanagar'],

  // East Bengaluru
  'Indiranagar': ['Hennur', 'Koramangala', 'Whitefield'],
  'Whitefield': ['Indiranagar', 'Koramangala', 'Electronic City'],

  // South Bengaluru
  'Koramangala': ['Indiranagar', 'Jayanagar', 'JP Nagar', 'Electronic City'],
  'Jayanagar': ['Koramangala', 'JP Nagar', 'Vijayanagar'],
  'JP Nagar': ['Jayanagar', 'Koramangala', 'Electronic City'],
  'Electronic City': ['JP Nagar', 'Koramangala', 'Whitefield'],
};
