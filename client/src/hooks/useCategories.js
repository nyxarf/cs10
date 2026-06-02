/**
 * useCategories — fetches the live category list from /api/categories.
 * Returns { categories, loading } where each category has { path, label, description }.
 * Falls back to empty array on error.
 */
import { useState, useEffect } from 'react';
import api from '../api/client';

let _cache = null;
let _fetching = null;

export function useCategories() {
  const [categories, setCategories] = useState(_cache || []);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) { setCategories(_cache); setLoading(false); return; }
    if (!_fetching) {
      _fetching = api.get('/categories')
        .then(res => {
          _cache = res.data.categories || res.data.flat || [];
          return _cache;
        })
        .catch(() => [])
        .finally(() => { _fetching = null; });
    }
    _fetching.then(cats => {
      setCategories(cats);
      setLoading(false);
    });
  }, []);

  return { categories, loading };
}
