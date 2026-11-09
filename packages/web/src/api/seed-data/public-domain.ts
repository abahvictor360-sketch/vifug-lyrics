/**
 * A small starter library for anyone who is not using Vifug for worship.
 *
 * Every song here is in the public domain: the words were published long
 * enough ago, or are traditional, so there is no licence to buy to put them on
 * a screen. That is the only reason these and not today's songs. Lyrics for
 * current music belong to their owners; Vifug does not ship them, and an
 * operator who has the right to display a song adds it themselves.
 *
 * Same plain-text form the importer reads: a header line, then the words.
 */
export type StarterSong = { title: string; authors?: string[]; raw: string };

export const publicDomainSongs: StarterSong[] = [
  {
    title: "Auld Lang Syne",
    authors: ["Robert Burns"],
    raw: `Verse 1
Should auld acquaintance be forgot,
And never brought to mind?
Should auld acquaintance be forgot,
And auld lang syne?

Chorus
For auld lang syne, my dear,
For auld lang syne,
We'll take a cup o' kindness yet,
For auld lang syne.

Verse 2
And surely ye'll be your pint-stowp!
And surely I'll be mine!
And we'll tak a cup o' kindness yet,
For auld lang syne.

Verse 3
We twa hae run about the braes,
And pu'd the gowans fine;
But we've wander'd mony a weary fit,
Sin' auld lang syne.`,
  },
  {
    title: "Happy Birthday to You",
    raw: `Verse 1
Happy birthday to you,
Happy birthday to you,
Happy birthday dear friend,
Happy birthday to you.`,
  },
  {
    title: "Twinkle, Twinkle, Little Star",
    authors: ["Jane Taylor"],
    raw: `Verse 1
Twinkle, twinkle, little star,
How I wonder what you are!
Up above the world so high,
Like a diamond in the sky.

Verse 2
When the blazing sun is gone,
When he nothing shines upon,
Then you show your little light,
Twinkle, twinkle, all the night.

Verse 3
Then the traveller in the dark
Thanks you for your tiny spark;
He could not see which way to go,
If you did not twinkle so.`,
  },
  {
    title: "Row, Row, Row Your Boat",
    raw: `Verse 1
Row, row, row your boat,
Gently down the stream.
Merrily, merrily, merrily, merrily,
Life is but a dream.`,
  },
  {
    title: "Jingle Bells",
    authors: ["James Lord Pierpont"],
    raw: `Verse 1
Dashing through the snow,
In a one-horse open sleigh,
O'er the fields we go,
Laughing all the way.
Bells on bobtail ring,
Making spirits bright,
What fun it is to ride and sing
A sleighing song tonight!

Chorus
Jingle bells, jingle bells,
Jingle all the way.
Oh! what fun it is to ride
In a one-horse open sleigh, hey!
Jingle bells, jingle bells,
Jingle all the way.
Oh! what fun it is to ride
In a one-horse open sleigh.`,
  },
  {
    title: "Oh! Susanna",
    authors: ["Stephen Foster"],
    raw: `Verse 1
I come from Alabama with my banjo on my knee,
I'm going to Louisiana, my true love for to see.
It rained all night the day I left, the weather it was dry,
The sun so hot I froze to death, Susanna, don't you cry.

Chorus
Oh! Susanna, oh, don't you cry for me,
For I come from Alabama with my banjo on my knee.`,
  },
  {
    title: "Home on the Range",
    raw: `Verse 1
Oh, give me a home where the buffalo roam,
Where the deer and the antelope play;
Where seldom is heard a discouraging word,
And the skies are not cloudy all day.

Chorus
Home, home on the range,
Where the deer and the antelope play;
Where seldom is heard a discouraging word,
And the skies are not cloudy all day.`,
  },
  {
    title: "Danny Boy",
    authors: ["Frederic Weatherly"],
    raw: `Verse 1
Oh Danny boy, the pipes, the pipes are calling,
From glen to glen, and down the mountain side;
The summer's gone, and all the roses falling,
'Tis you, 'tis you must go and I must bide.

Chorus
But come ye back when summer's in the meadow,
Or when the valley's hushed and white with snow,
'Tis I'll be here in sunshine or in shadow,
Oh Danny boy, oh Danny boy, I love you so.`,
  },
  {
    title: "Greensleeves",
    raw: `Verse 1
Alas, my love, you do me wrong,
To cast me off discourteously.
For I have loved you well and long,
Delighting in your company.

Chorus
Greensleeves was all my joy,
Greensleeves was my delight,
Greensleeves was my heart of gold,
And who but my lady Greensleeves.`,
  },
  {
    title: "Take Me Out to the Ball Game",
    authors: ["Jack Norworth"],
    raw: `Chorus
Take me out to the ball game,
Take me out with the crowd;
Buy me some peanuts and Cracker Jack,
I don't care if I never get back.
Let me root, root, root for the home team,
If they don't win, it's a shame.
For it's one, two, three strikes, you're out,
At the old ball game.`,
  },
  {
    title: "She'll Be Coming 'Round the Mountain",
    raw: `Verse 1
She'll be coming 'round the mountain when she comes, (toot, toot!)
She'll be coming 'round the mountain when she comes, (toot, toot!)
She'll be coming 'round the mountain,
She'll be coming 'round the mountain,
She'll be coming 'round the mountain when she comes. (toot, toot!)`,
  },
  {
    title: "My Bonnie Lies Over the Ocean",
    raw: `Verse 1
My Bonnie lies over the ocean,
My Bonnie lies over the sea,
My Bonnie lies over the ocean,
Oh, bring back my Bonnie to me.

Chorus
Bring back, bring back,
Oh, bring back my Bonnie to me, to me;
Bring back, bring back,
Oh, bring back my Bonnie to me.`,
  },
  {
    title: "Waltzing Matilda",
    authors: ["A. B. \"Banjo\" Paterson"],
    raw: `Verse 1
Once a jolly swagman camped by a billabong,
Under the shade of a coolibah tree,
And he sang as he watched and waited till his billy boiled,
"You'll come a-waltzing Matilda with me."

Chorus
Waltzing Matilda, waltzing Matilda,
You'll come a-waltzing Matilda, with me,
And he sang as he watched and waited till his billy boiled,
"You'll come a-waltzing Matilda with me."`,
  },
];
