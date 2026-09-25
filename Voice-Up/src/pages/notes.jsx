import { useState } from "react";

export default function NotesPage() {

  let [notes, setNotes] = useState([]);


  return (
    
    <div className="flex flex-row flex-wrap ml-5 mt-5 gap-4 bg-[#f9f5f1]">
      <button className="transition-colors ease-in-out duration-300 h-60 w-60 border-b-black border-2 hover:bg-[#d49263] transition-colors bg-[#b97f55] rounded-2xl" onClick={() => setNotes([...notes, {}])}>
        <div className="text-white">New Note</div>
      </button>
      {notes.map((note, i) =>
        <div className="h-60 w-60 border-black border-2 flex justify-center items-center hover:bg-[#d49263] transition-colors bg-[#b97f55] text-white rounded-2xl" onClick={() => document.getElementById('my_modal_1').showModal()}>Topic</div>

      )}
      {/* Open the modal using document.getElementById('ID').showModal() method */}
      <dialog id="my_modal_1" className="modal transition-colors ease-in-out duration-300">
        <div className="w-4/5 h-200 bg-base-100">
          <textarea className="font-bold text-lg text-center h-17 resize-none textarea-ghostw">Topic</textarea>
          <textarea className="textarea textarea-ghost resize-none w-300 h-163" placeholder="Start typing..."></textarea>
          <div className="modal-action h-20">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn">Close</button>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  );
}