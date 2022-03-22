import SpotifyWebApi from 'spotify-web-api-node'
import csv from 'csvtojson'
import log from 'loglevel';
import * as fs from 'fs'
import axios from 'axios'
import cliProgress from 'cli-progress'
import 'dotenv/config'

import { deezerLogin } from './deezer-auth.js'

if (process.argv.slice(2) == 'login') {
    await deezerLogin()
    process.exit(0)
}

log.setLevel('INFO')

// Set env variables
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const deezerAccessToken = process.env.DEEZER_ACCESS_TOKEN;
const deezerFullSearch = process.env.DEEZER_FULL_SEARCH;
const archiveDeezerPlaylists = process.env.ARCHIVE_DEEZER_PLAYLISTS
const webhookUrl = process.env.WEBHOOK_URL

if (!spotifyClientId || !spotifyClientSecret || !deezerAccessToken || !deezerFullSearch || !archiveDeezerPlaylists) {
    log.error('Missing required environment variables. Please take a look at the repository for required environment variables.')
    process.exit(1)
}

const spotifyApi = new SpotifyWebApi({
    clientId: spotifyClientId,
    clientSecret: spotifyClientSecret,
})

await spotifyApi.clientCredentialsGrant().then(
    function (data) {
        log.info(`Authenticated with Spotify.`)
        // Save the access token so that it's used in future calls
        spotifyApi.setAccessToken(data.body['access_token']);
    },
    function (err) {
        console.log('Something went wrong when retrieving an access token', err);
    }
);

let spotifyPlaylists = []
let deezerPlaylists = []
let playlistTracks = []

// CSV to Json
async function parseCsv(file) {
    try {
        if (fs.existsSync(file)) {
            return await csv().fromFile(file)
        } else {
            log.error(`${file} does not exists.`)
            process.exit(1)
        }
    } catch (error) {
        log.error('Error parsing file.')
    }
}

// Read Spotify playlists from txt
async function getSpotifyPlaylists() {
    log.info('Reading Spotify playlists.')
    const parsedCsv = await parseCsv('/data/spotify-playlists.txt')
    log.info(`Found ${parsedCsv.length} Spotify playlists.`)
    spotifyPlaylists = parsedCsv
}

// Read Deezer playlists from txt
async function getDeezerPlaylists() {
    log.info('Reading Deezer playlists.')
    const parsedCsv = await parseCsv('/data/deezer-playlists.txt')
    log.info(`Found ${parsedCsv.length} Deezer playlists.`)
    deezerPlaylists = parsedCsv
}

async function writeFile(name, data) {
    try {
        fs.writeFileSync(`/data/${name}`, data)
    } catch (error) {
        log.error('Error writing file', error)
    }
}

async function spotifyPlaylistToCsv(tracks, name) {
    const tempPlaylist = []

    tempPlaylist.push([
        'title',
        'artist',
        'album',
        'spotifyId'
    ])

    for await (const track of tracks) {
        const newTrackArray = [
            `"${track.track.name}"`,
            `"${track.track.artists[0].name}"`,
            `"${track.track.album.name}"`,
            `"${track.track.id}"`
        ]
        tempPlaylist.push(newTrackArray)
    }

    let csvContent = '';
    for await (const spotifyTrack of tempPlaylist) {
        let row = spotifyTrack.join(',')
        csvContent += row + "\r\n";
    }

    await writeFile(`${name}_spotify.csv`, csvContent)
}

async function deeezerPlaylistToCsv(tracks, name) {
    const tempPlaylist = []

    tempPlaylist.push([
        'title',
        'artist',
        'album',
        'deezerId'
    ])

    for await (const track of tracks) {
        const newTrackArray = [
            `"${track.title}"`,
            `"${track.artist.name}"`,
            `"${track.album.title}"`,
            `"${track.id}"`
        ]
        tempPlaylist.push(newTrackArray)
    }

    let csvContent = '';
    for await (const deezerTrack of tempPlaylist) {
        let row = deezerTrack.join(',')
        csvContent += row + "\r\n";
    }
    log.info(`Writing Deezer ${name} playlist CSV archive.`)
    await writeFile(`${name}_deezer.csv`, csvContent)
}



async function fetchPlaylistTracks(playlistId, offset) {
    try {
        const data = await spotifyApi.getPlaylistTracks(playlistId, { offset })
        return data
    } catch (error) {
        console.log('Error fetching playlist tracks from Spotify API', error)
    }
}

async function loopPlaylistTracks(id, name, deezerPlaylistId) {

    log.info(`Fetching tracks for playlist ${name}`)
    var data = await spotifyApi.getPlaylistTracks(id);

    var numBatches = Math.floor(data.body.total / 100) + 1;

    var tracks = [];

    for (let batchNum = 0; batchNum < numBatches; batchNum++) {
        const getSongs = await fetchPlaylistTracks(id, batchNum * 100);
        for await (const track of getSongs.body.items) {
            tracks.push(track)
        }
    }

    log.info(`Found ${tracks.length} tracks in Spotify playlist ${name}`)

    const playlistTrackObject = {
        name,
        deezerPlaylistId,
        tracks
    }

    playlistTracks.push(playlistTrackObject)

    const safeFileName = name.replace(/[\\/:*?"<>|]/g, '')
    const fileData = JSON.stringify(tracks)
    await writeFile(`${safeFileName}_spotify.json`, fileData)
    await spotifyPlaylistToCsv(tracks, safeFileName)
}

// Read spotify-playlists.csv
await getSpotifyPlaylists();

async function getDeezerTrackFromIsrc(isrc) {
    try {
        const track = await axios.get(`https://api.deezer.com/2.0/track/isrc:${isrc}`)
        return track.data
    } catch (error) {
        log.error('Error fetching Deezer track via isrc.', error)
    }
}

async function getDeezerTrackFullSearch(title, artist, album) {
    try {
        const track = await axios.get(`https://api.deezer.com/search/track?limit=1&strict=on&q=track:"${title}" artist:"${artist}" album:"${album}"`)
        return track.data.data
    } catch (error) {
        log.error('Error searching Deezer track.', error)
    }
}

// Loop each playlist and fetch the tracks
for await (const playlist of spotifyPlaylists) {
    await loopPlaylistTracks(playlist.id, playlist.name, playlist.deezerPlaylistId)
}

// Add Deezer tacks to Deezer playlist
async function addDeezerTracksToPlaylist(tracks, playlistId) {
    log.info('Adding playlist tracks to Deezer playlist.')
    const deezerAddTrackBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);


    // Create array of track IDs
    const tempTracks = []
    for await (const t of tracks) {
        tempTracks.push(t.id)
    }

    // Deezer "add track to playlist" API allows adding multiple tracks at once.
    // Split the array of track ids into sets of 20 for fewer API calls.
    const n = 20
    const result = new Array(Math.ceil(tempTracks.length / n)).fill().map(_ => tempTracks.splice(0, n))

    deezerAddTrackBar.start(result.length, 0)

    // Loop through and add each set of 20 songs to the playlist
    for await (const trackIdArray of result) {
        try {
            const addTrack = await axios.post(`https://api.deezer.com/playlist/${playlistId}/tracks`, {}, {
                params: {
                    songs: trackIdArray.toString(),
                    access_token: deezerAccessToken
                }
            })
            deezerAddTrackBar.increment()
        } catch (error) {
            info.error('Error adding track to Deezer playlist', error)
        }
    }

    deezerAddTrackBar.stop();

}

async function getDeezerPlaylist(id) {
    try {
        const playlist = await axios.get(`https://api.deezer.com/playlist/${id}/tracks?limit=99999`, {}, {
            params: {
                access_token: deezerAccessToken,
            }
        })
        return playlist.data.data
    } catch (error) {
        log.error('Error fetching Deezer playlist', error)
    }
}

// Loop each spotify playlist track array and attempt to match isrc on Deezer
for await (const playlist of playlistTracks) {
    // Spotify playlist is now 'playlist'
    log.info(`Performing Deezer isrc searches for playlist ${playlist.name}`)

    const deezerPlaylistTracks = []

    const deezerGetTrackBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

    deezerGetTrackBar.start(playlist.tracks.length, 0)

    for await (const track of playlist.tracks) {

        let deezerTrack
        // Attempt to find the track on Deezer via isrc
        deezerTrack = await getDeezerTrackFromIsrc(track.track.external_ids.isrc)


        // If track is not found via isrc attempt a full search
        if (deezerTrack.error) {
            if (deezerFullSearch == 'true') {
                const searchTrack = await getDeezerTrackFullSearch(track.track.name, track.track.artists[0].name, track.track.album.name)
                deezerTrack = searchTrack[0]
                if (!deezerTrack) {
                    log.info(`Failed to find track ${track.track.name}`)
                }
            }
        }
        if (deezerTrack) {
            if (deezerTrack.id) {
                deezerPlaylistTracks.push(deezerTrack)
            }
        }

        deezerGetTrackBar.increment();

    }

    deezerGetTrackBar.stop();

    log.info(`\nFound ${deezerPlaylistTracks.length} tracks on Deezer from ${playlist.name} playlist.`)

    // Add tracks to Deezer playlist
    await addDeezerTracksToPlaylist(deezerPlaylistTracks, playlist.deezerPlaylistId)

    // Fetch Deezer playlist
    const deezerPlaylist = await getDeezerPlaylist(playlist.deezerPlaylistId)

    // Write Deezer playlist to legible csv & full json
    const safeFileName = playlist.name.replace(/[\\/:*?"<>|]/g, '')
    await deeezerPlaylistToCsv(deezerPlaylist, safeFileName)
    const fileData = JSON.stringify(deezerPlaylist)
    log.info(`Writing Deezer ${playlist.name} playlist JSON archive.`)
    await writeFile(`${safeFileName}_deezer.json`, fileData)
}

if (archiveDeezerPlaylists == 'true') {
    log.info('\nArchiving Deezer playlists.')

    await getDeezerPlaylists();

    for await (const playlist of deezerPlaylists) {

        const deezerPlaylist = await getDeezerPlaylist(playlist.id)

        // Write Deezer playlist to legible csv & full json
        const safeFileName = playlist.name.replace(/[\\/:*?"<>|]/g, '')

        await deeezerPlaylistToCsv(deezerPlaylist, safeFileName)

        const fileData = JSON.stringify(deezerPlaylist)

        log.info(`Writing Deezer ${playlist.name} playlist JSON archive.`)
        await writeFile(`${safeFileName}_deezer.json`, fileData)
    }
}

if (webhookUrl) {
    try {
        await axios.post(webhookUrl, { content: 'Spotify to Deezer conversion completed and files have been archived.' })
    } catch (error) {
        log.error('Error sending webhook.', error)
    }
}

process.exit(0);