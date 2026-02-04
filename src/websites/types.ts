export interface MediaContext {
  title: string
  tmdb_id: number | null
  type: "tv" | "movie"
  season: number | null
  episode: number | null
  episode_id: number | null
  currentTime: number
}
