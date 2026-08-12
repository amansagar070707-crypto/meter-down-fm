import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const response = await fetch("http://localhost:3000/api/admin/playlists/import", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${process.env.ADMIN_API_TOKEN}`,
  },
  body: JSON.stringify({
    url: "https://music.youtube.com/playlist?list=RDCLAK5uy_kNNx8o3LyD3XF_wKmbZZRMsdiYpo5GjrM&playnext=1&si=1c5-L9_Hpb5xpFSB",
    activate: true,
  }),
});

console.log(JSON.stringify({ status: response.status, body: await response.json() }));
process.exitCode = response.ok ? 0 : 1;
