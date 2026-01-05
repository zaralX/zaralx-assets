const axios = require('axios')

function isValidMinecraftNickname(nickname) {
    const regex = /^[a-zA-Z0-9_]{3,16}$/;
    return regex.test(nickname);
}

async function nicknameToUUID(nickname) {
    const res = await axios.get(
        `https://api.mojang.com/users/profiles/minecraft/${nickname}`,
        { validateStatus: s => s === 200 || s === 204 }
    )

    if (res.status === 204) {
        throw new Error('Player not found')
    }

    return res.data.id
}

module.exports = {isValidMinecraftNickname, nicknameToUUID}
