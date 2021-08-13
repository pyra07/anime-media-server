// Type that contains 480 720 or 1080p resolution
export type Resolution = '480' | '720' | '1080';
export interface AnimeTorrent {
    title : string;
    link : string;
    pubDate : string;
    "nyaa:seeders" : string;
    content : string;
    contentSnipet : string;
    guid : string;
    isoDate : string;
}