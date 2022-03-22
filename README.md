
# Spotify to Deezer

Spotify to Deezer is an application which allows you to convert your Spotify playlists to Deezer playlists. No more sketchy 3rd party websites that have access to all of your songs and limit the number of tracks per conversion. It also downloads playlist information, so in the event a playlist or account is deleted, the tracks are not lost.

![spotify2deezer](https://user-images.githubusercontent.com/21207065/159560991-6d6fc08a-a11e-47ee-b073-eefdc38d375c.gif)

### What Does It Do?

 - Converts Spotify playlists to Deezer playlists.
 - Downloads Spotify playlist data in JSON via the API and an easier to read CSV.
 - Downlods Deezer playlist data in JSON via the API and an easier to read CSV.

### How It Works

The Spotify tracks are searched against Deezer's database via ISRC tags. For 99% of the time this works without issue. Some obscure songs tend to have varying ISRC tags between the platforms which results in the song not being found. To help combat this issue, a setting can be enabled which performs a full track title, artist, and album search to attempt to find the track. Do note, this can lead to a false positive being returned due to how Deezer's API works. My advice is to keep that setting off and only use ISRC tags.

### Archiving

One of the motivating factors for this tool is archival purposes. For each playlist being converted an accompanying JSON and CSV file is created for both Spotify and Deezer containing playlist data and tracks.

The Deezer CSV files were made to be used with my [Navidrome Playlist Generator](https://github.com/Zibbp/Navidrome-Playlist-Generator) which creates Navidrome playlists from the Deezer CSV files after downloading the tracks.

### Getting Started

1. Save a copy of the `docker-compose.yml` file.
2. Create a [Spotify application](https://developer.spotify.com/dashboard/applications) for authentication.
3. Create a [Deezer application](https://developers.deezer.com/myapps) for authentication.
   * Ensure the "Redirect URL" is set to `http://localhost:5000`.
4. Enter the Spotify client id and secret along with the Deezer app id and secret in the `docker-compose.yml` file.
5. Run `docker-compose run spotify2deezer node main.js login` and follow the prompts to retrieve your Deezer access token.
6. Once you have the Deezer access token, add it to the `docker-compose.yml` file.
7. Create a folder named `data` and add the path to the `docker-compose.yml` file.
8. In the data folder create a file named `spotify-playlists.txt`.
   * The `spotify-playlists.txt` file should look like the below. Where `id` is the Spotify playlist id, `name` is the Spotify playlist name, and `deezerPlaylistId` is the id of the Deezer playlist you will need to create for each playlist.

```
id,name,deezerPlaylistId
79QHayucQm6M4wUlUbhQNQ,Metalcore,1234567890
```
9. Run `docker-compose up`.

### Options

 - `DEEZER_FULL_SEARCH=true/false`
   * Set to `true` to attempt to find tracks not found via the ISRC tag. Do note that this can lead to false positives being added. 
 - `ARCHIVE_DEEZER_PLAYLISTS=true/false`
   * Set to `true` to download JSON and CSV files for Deezer playlists. Mainly used for [Navidrome Playlist Generator](https://github.com/Zibbp/Navidrome-Playlist-Generator) to import playlists originated from Deezer and not converted. If enabled, a file named `deezer-playlists.txt` needs to be created in your `/data` folder with the following format.

```
id,name
8180167902,Metal Experience
```

 - `WEBHOOK_URL=https://webhook.service`
   * Enter a webhook url to be notified when the container finishes.
