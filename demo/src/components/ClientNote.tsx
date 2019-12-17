import React from 'react'

export interface ClientNoteProps {
    noteText: string
    onChange: (val: string) => void
}

export const ClientNote = (props: ClientNoteProps) => {
    return <textarea value={props.noteText} onChange={(e) => props.onChange(e.target.value)}></textarea>
}