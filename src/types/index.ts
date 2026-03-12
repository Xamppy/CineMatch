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

export type RoomStatus = "lobby" | "swiping" | "completed";

export interface Room {
  id: string;
  code: string;
  createdBy: string;
  status: RoomStatus;
  createdAt: string;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  isReady: boolean;
  joinedAt: string;
}

export interface RoomMovie {
  id: string;
  roomId: string;
  userId: string;
  movieId: number;
  movieTitle: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  overview: string | null;
  addedAt: string;
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
