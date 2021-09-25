# animu

## What is this project about?

Conveniently downloads you the latest anime releases locally, without having to access a third-party site.

## Why did I make this?

Simply put, I got bored of continuously accessing websites filled with intrusive ads. The optimal solution would have been to install adblock (duh), but why not take the hard, long path?

## How does this work? (in simple terms)

You give the program your Anilist profile. It looks at your current "*WATCHING*" list, determines what episodes you are missing, and proceeds to download them for you! You are then free to do whatever you want with the downloaded files, whether it be hosting them locally on a media server, or just downloading them for a road trip!

## How do I set this up?

1. `npm install`
2. Download qbittorrent
3. Enable Web UI 
4. Fill in `profile.json` with the following details:


* _torrent_url_ ,where your qbittorrent server is set up at, usually gonna be "http://localhost:8080/"

* _email_ and _emailPassword_, both obtained from firebase (details on how to sign up shall be implemented later!)
  
*  _username_ and _password_
  
* Get your Anilist _username_ 

* Choose which _resolution_ to download anime. "480","720" or "1080" accepted

* _root_dir_, where you want your downloads to be stored.

5. Run `ts-node main.ts` (P.S you might need VPN)
