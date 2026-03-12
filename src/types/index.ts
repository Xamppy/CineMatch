export interface Movie {
  id: number;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string;
  voteAverage: number;
  genreIds: number[];
}

export interface Room {
  id: string;
  code: string;
  createdBy: string;
  createdAt: string;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  joinedAt: string;
}

export interface MovieVote {
  id: string;
  roomId: string;
  userId: string;
  movieId: number;
  movieTitle: string;
  posterPath: string | null;
  backdropPath: string | null;
  vote: "like" | "dislike";
  createdAt: string;
}

export interface Match {
  id: string;
  roomId: string;
  movieId: number;
  movieTitle: string;
  posterPath: string | null;
  matchedAt: string;
}

export type SwipeDirection = "left" | "right";

export interface Profile {
  id: string;
  username: string;
  avatarUrl: string | null;
  createdAt: string;
}
