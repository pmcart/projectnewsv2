import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

export interface WikipediaSummary {
  title: string;
  extract: string;
  thumbnail?: string;
  pageUrl: string;
}

@Injectable({ providedIn: 'root' })
export class WikipediaService {
  constructor(private http: HttpClient) {}

  /**
   * Search Wikipedia and get summaries for top results
   */
  searchAndGetSummaries(query: string, limit: number = 3): Observable<WikipediaSummary[]> {
    if (!query || query.trim().length < 3) {
      return of([]);
    }

    // Use Wikipedia's API with CORS support
    const searchUrl = 'https://en.wikipedia.org/w/api.php';
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: limit.toString(),
      format: 'json',
      origin: '*'
    });

    return this.http.get<any>(`${searchUrl}?${params}`).pipe(
      switchMap(response => {
        const results = response?.query?.search || [];
        if (results.length === 0) {
          return of([]);
        }

        // Get page extracts for the search results
        const titles = results.map((r: any) => r.title).join('|');
        const extractParams = new URLSearchParams({
          action: 'query',
          titles: titles,
          prop: 'extracts|pageimages',
          exintro: 'true',
          explaintext: 'true',
          exsentences: '3',
          piprop: 'thumbnail',
          pithumbsize: '100',
          format: 'json',
          origin: '*'
        });

        return this.http.get<any>(`${searchUrl}?${extractParams}`).pipe(
          map(extractResponse => {
            const pages = extractResponse?.query?.pages || {};
            return Object.values(pages)
              .filter((page: any) => page.extract && page.extract.length > 50)
              .map((page: any) => ({
                title: page.title,
                extract: page.extract,
                thumbnail: page.thumbnail?.source,
                pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
              }))
              .slice(0, limit);
          })
        );
      }),
      catchError(err => {
        console.error('Wikipedia API error:', err);
        return of([]);
      })
    );
  }

  /**
   * Extract key search terms from article text and search Wikipedia
   */
  getContextForArticle(title: string, description: string = '', limit: number = 3): Observable<WikipediaSummary[]> {
    const searchQuery = this.extractSearchQuery(title, description);
    if (!searchQuery) {
      return of([]);
    }
    return this.searchAndGetSummaries(searchQuery, limit);
  }

  /**
   * Extract meaningful search terms from title and description
   */
  private extractSearchQuery(title: string, description: string): string {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
      'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'it', 'its', 'this', 'that', 'says',
      'said', 'new', 'after', 'before', 'over', 'about', 'into', 'just',
      'how', 'why', 'what', 'when', 'where', 'who', 'which', 'up', 'out',
      'more', 'most', 'some', 'all', 'any', 'no', 'not', 'only', 'also',
      'now', 'here', 'there', 'than', 'then', 'so', 'if', 'can', 'could',
      'would', 'should', 'may', 'might', 'must', 'report', 'reports', 'says'
    ]);

    // Combine title and description, prioritize title
    const text = title + ' ' + (description || '').substring(0, 100);

    // Extract words, filter stop words
    const words = text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));

    // Prioritize capitalized words (likely proper nouns)
    const capitalizedWords = words.filter(w => /^[A-Z]/.test(w));
    const otherWords = words.filter(w => !/^[A-Z]/.test(w));

    // Build query: prioritize capitalized words, then others
    const queryWords = [...new Set([...capitalizedWords, ...otherWords])].slice(0, 4);

    return queryWords.join(' ');
  }
}
