import { ImageSourcePropType } from 'react-native'
import { ImageAssets } from '../../components/ImageAssets'

export type PromoCardModel = {
  id: string
  titleLines: [string, string]
  description: string
  image: ImageSourcePropType
  colors: [string, string]
  /** Match web `.promotions_block.*` layout tweaks */
  variant: 'default' | 'startbig' | 'basketball' | 'cricket'
}

/** Left / right gradient stops – from `promotions.css` */
export const PROMO_CARDS: PromoCardModel[] = [
  {
    id: 'play-smart',
    titleLines: ['Play Smart.', 'Win Big.'],
    description: 'Classic cards with thrilling rewards!',
    image: ImageAssets.smilingCartoonPng,
    colors: ['#1E2B2D', '#238A3F'],
    variant: 'default',
  },
  {
    id: 'run-fast',
    titleLines: ['Run Fast.', 'Win Big.'],
    description: 'Stay in the game and multiply your rewards.',
    image: ImageAssets.funChickenPng,
    colors: ['#1E2B2D', '#8F2127'],
    variant: 'default',
  },
  {
    id: 'real-dealers',
    titleLines: ['Real Dealers.', 'Real Action.'],
    description: 'Experience the thrill of live casino games anytime.',
    image: ImageAssets.dealersVectorPng,
    colors: ['#1E2B2D', '#2D669D'],
    variant: 'default',
  },
  {
    id: 'start-big',
    titleLines: ['Start Big.', 'Win Bigger.'],
    description: 'Get a big boost on your first deposit.',
    image: ImageAssets.startbigVectorPng,
    colors: ['#1E2B2D', '#931C66'],
    variant: 'startbig',
  },
  {
    id: 'basketball',
    titleLines: ['Basketball', 'Bets'],
    description: 'Real-Time Odds. Real-Time Thrill.',
    image: ImageAssets.basketballVectorPng,
    colors: ['#1E2B2D', '#11738A'],
    variant: 'basketball',
  },
  {
    id: 'cricket',
    titleLines: ['Play Smart.', 'Score More.'],
    description: 'Bet on every over and cash out strong!',
    image: ImageAssets.cricketPlayerPng,
    colors: ['#1E2B2D', '#955A20'],
    variant: 'cricket',
  },
]
