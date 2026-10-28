# Discord Moderasyon Botu

Komutlar:
- `/tam_yasakla kullanici [sebep]` : botun bulundugu TUM sunucularda yasaklar (sunucuda Yonetici yetkisi olanlar)
- `/ban kullanici [sebep]` : sadece bu sunucuda yasaklar
- `/kick kullanici [sebep]` : sadece bu sunucuda atar

`kullanici` alanina etiket yazabilir veya kullanici ID'sini yapistirabilirsin.

## 1) Discord'da bot olustur
1. https://discord.com/developers/applications > **New Application**
2. **Bot** sekmesi > **Reset Token** > tokeni kopyala (DISCORD_TOKEN)
3. **General Information** > **Application ID** kopyala (CLIENT_ID)
4. Ozel intent acmana gerek yok.
5. Davet linki (CLIENT_ID'yi degistir):
   `https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot%20applications.commands&permissions=6`
   (permissions=6 → Uyeleri At + Uyeleri Yasakla)
6. Botun rolunu sunucuda, yasaklayacagi kisilerin rollerinden **yukarida** tut.

## 2) Yerelde test (istege bagli)
```
npm install
cp .env.example .env   # icini doldur
npm start
```

## 3) GitHub
```
git init
git add .
git commit -m "ilk commit"
git branch -M main
git remote add origin https://github.com/KULLANICI/REPO.git
git push -u origin main
```
`.env` dosyasi .gitignore'da, GitHub'a gitmez. Tokeni asla paylasma.

## 4) Render
1. https://render.com > **New +** > **Web Service** > GitHub reposunu sec
2. Runtime: **Node**
3. Build Command: `npm install`
4. Start Command: `npm start`
5. **Environment** kismina ekle: `DISCORD_TOKEN`, `CLIENT_ID` (`OWNER_IDS` istege bagli)
6. Deploy.

Not: Render ucretsiz Web Service 15 dk istek gelmezse uyur. Botu 7/24 acik tutmak icin
https://uptimerobot.com ile Render URL'sine 5 dakikada bir ping at, veya ucretli plan / Background Worker kullan.
Ucretsiz Render'da dosya sistemi sifirlanir; `globalbans.json` her deploy'da silinir. Kalici liste icin ileride veritabani ekleriz.
