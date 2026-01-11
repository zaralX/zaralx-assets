import axios from 'axios';
import {FastifyInstance} from "fastify";

export function isValidMinecraftNickname(nickname: string) {
    const regex = /^[a-zA-Z0-9_]{3,16}$/;
    return regex.test(nickname);
}

export async function nicknameToUUID(fastify: FastifyInstance | null, nickname: string): Promise<string | null> {
    if (fastify) {
        const result = await fastify.redis.get(`minecraft_vanilla_nickname:${nickname}`)
        if (result) {
            return result
        }
    }
    const res = await axios.get(
        `https://api.mojang.com/users/profiles/minecraft/${nickname}`,
        { validateStatus: s => s === 200 || s === 204 || s === 404 }
    )

    if (res.status !== 200) {
        return null
    }

    if (fastify) {
        fastify.redis.set(`minecraft_vanilla_nickname:${nickname}`, res.data.id)
    }

    return res.data.id
}
