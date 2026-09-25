export default function HomePage() {

  return (
    <div className="flex flex-grow justify-center items-center bg-[#f9f6f3] flex-col">
      <div className="flex justify-center">
        <div className="h-50 w-100 flex justify-around items-center flex-col mb-10">
          <div className="flex justify-center items-center text-5xl">Greetings, user</div>
          <div className="flex justify-center items-center text-2xl">Finished where you left off: </div>
        </div>
        <div className="h-90 w-90 border-[#b97f55] border-3 rounded-full flex justify-center items-center flex-col bg-[#debba1]">
          <div className="flex justify-center items-center text-2xl mb-7">Topic: </div>

          <div className="flex justify-center items-center text-2xl mt-7">Time: </div>
        </div>
      </div>
    </div>
  );
}