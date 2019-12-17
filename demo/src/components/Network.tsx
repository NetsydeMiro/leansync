import React, { useReducer } from 'react'
import './Network.css'

import { mockNetworkReducer, initialNetwork } from '../../../support/MockNetwork'

const App: React.FC = () => {

    const [state, dispatch] = useReducer(mockNetworkReducer, initialNetwork)

    return (
        <div>

        </div>
    )
}

export default App
