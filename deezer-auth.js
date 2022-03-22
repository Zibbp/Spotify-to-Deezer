import inquirer from 'inquirer'
import axios from 'axios'
import 'dotenv/config'

export async function deezerLogin() {
    const deezerAppId = process.env.DEEZER_APP_ID
    const deezerAppSecret = process.env.DEEZER_APP_SECRET
    const deezerRedirectUrl = 'http://localhost:5000/callback'

    if (!deezerAppId || !deezerAppSecret) {
        console.log("Missing Deezer app ID or secret.")
        process.exit(1)
    }

    // SCOPES:
    // manage_library: Allow applicate to manage playlists
    // offline_access: Never expiring access token
    const deezerOauthUrl = `https://connect.deezer.com/oauth/auth.php?app_id=${deezerAppId}&redirect_uri=${deezerRedirectUrl}&perms=manage_library,offline_access`

    console.log(`Copy and paste the below URL into your browser. Once authenticated, copy the entire callback address and paste it in the console.`)

    console.log(deezerOauthUrl)

    const input = await inquirer.prompt({
        type: 'input',
        name: 'callback',
        message: 'Authenticated URL'
    })

    // Get the "code" url parameter
    const url = new URL(input.callback)
    const code = url.searchParams.get('code')

    if (!code) {
        console.log('Invalid URL. Code parameter not found.')
        process.exit(1)
    }

    // Request access token
    const accessTokenResponse = await axios.get(`https://connect.deezer.com/oauth/access_token.php?app_id=${deezerAppId}&secret=${deezerAppSecret}&code=${code}`)

    const accessToken = accessTokenResponse.data.replace('access_token=', "").replace('&expires=0', '')

    console.log(`Access token: ${accessToken}`)

}