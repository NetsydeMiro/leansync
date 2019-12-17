import React, { useState, Dispatch, ReducerAction, Reducer } from 'react'
import './Client.css'

import { MockClient, MockNetwork, ActionType } from '../../../support/MockNetwork'
import { Note, newNote } from '../../../support/Note'
import { ClientNote } from './ClientNote'

interface ClientProps extends MockClient {
  clientIndex: number
  dispatch: Dispatch<ReducerAction<Reducer<MockNetwork, ActionType>>>
}

interface ClientState {
  notes: Array<Note>
}

const Client: React.FC<ClientProps> = (props) => {
  let [notes, setNotes] = useState(props.notes)

  // TODO: refactor with NotesDatabase?
  // TODO: add client note database & operations
  let getNoteUpdateHandler = (noteIndex: number) => (noteText: string) => {
    let updatedNotes = notes.slice()

    let updatedNote = { ...updatedNotes[noteIndex] }

    updatedNote.text = noteText

    updatedNotes[noteIndex] = updatedNote

    setNotes(updatedNotes)
  }

  let noteComponents = notes.map((note, ix) => <ClientNote noteText={note.text} onChange={getNoteUpdateHandler(ix)} />)

  let addNoteHandler = () => {
    let updatedNotes = notes.slice()

    updatedNotes.push(newNote(''))

    setNotes(updatedNotes)
  }

  let toggleOffline = () => {
    props.dispatch({ type: 'setClientOffline', clientIndex: props.clientIndex, isOffline: !props.isOffline })
  }

  return (
    <div>
      <label>
        <input type='checkbox' onClick={toggleOffline} />
        Is Offline
      </label><br />
      {noteComponents}
      <button onClick={addNoteHandler}>New</button>
      <button onClick={addNoteHandler}>Sync</button>
    </div>
  )
}

export default Client
