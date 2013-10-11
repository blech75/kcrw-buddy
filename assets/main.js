var KCRWBuddy = (function(){
  
  // data to pull AJAX data from. currently, we're pulling from the same host 
  // to avoid cross-domain issues. this accomplished by a simple apache 
  // proxypass directive that passes the request to kcrw.org.
  var AJAX_HOSTNAME = window.location.host;
  
  // KCRW's default album art image
  var DEFAULT_ALBUM_ART = "/images/no_album.jpg";

  // let's not be too noisy. KCRW has their web page throttled to every 20s, 
  // so let's do the same.
  var REFRESH_INTERVAL = 20 * 1000;

  // holds timeout reference so we can cancel it if need be
  var timeout = null;

  // what it says on the tin
  var current_song_data = null;


  function retrieveNowPlaying(){
    // values are "Music" (Eclectic 24) or "Simulcast"
    var channel = "Music";

    // channel seems to be the only required parameter to retrieve the now 
    // playing data for the "Music" channel
    var request_data = {
      "channel" : channel
      // "dates" : "2013-10-03",
      // "hours" : "13",
      // "drive_flag" : "0"
    };

    // fetch the JSON data via AJAX
    $.ajax({
      'type'     : 'GET',
      'url'      : 'http://' + AJAX_HOSTNAME + '/tracklists/includes/table_currenthour.php?data=' + JSON.stringify(request_data),
      'dataType' : 'json',
      'success'  : handleResponseSuccess,
      'error'    : handleResponseError
    });
  }

  function handleResponseSuccess(data){

    // check for ajax response first
    if (data.message != "") {

      // parse the received data
      var new_data = parseNowPlayingData($(data.message));

      // fix the timezone and store it as a new attribute for display
      new_data.display_time = fixTimezone(new_data.datetime).format('h:mm A');

      // get the prev song's start time if it exists
      var prev_song_start_time = (current_song_data && current_song_data.datetime) ? current_song_data.datetime : "";
      // console.log("NEW: " + new_data.datetime, "PREV: " + prev_song_start_time);

      // compare previous song's start time to current song's start time to 
      // determine if song has changed. this should work reasonbly well. 
      // possibly revisit later and change comparison to use a cryptographic 
      // hash of all song data.
      var song_has_changed = (new_data.datetime !== prev_song_start_time);

      // consider our work finalized and assign newly fetched data to our 
      // current state
      current_song_data = new_data;

      // update the display only if the data is different from the previous data
      if (song_has_changed) {
        console.log("song change detected (" + new_data.display_time + ")");
        displayNowPlayingData(current_song_data);

        // only fetch artwork if we don't have it, which is generally for new 
        // songs. in other words, don't fetch if we've already tried and no 
        // results were returned.
        // note: this is asynchronous so it's somewhat complicated
        findLargerArtwork(current_song_data.artist + " " + current_song_data.album);
      }

    }

    // refresh the data in the not-too-distant future
    timeout = setTimeout(retrieveNowPlaying, REFRESH_INTERVAL);
  }

  function handleResponseError(data){
    // FIXME: do something more intelligent here
    console.log("handleResponseError");
    console.log(arguments);
  }

  // pull the data out of HTML and into an object
  function parseNowPlayingData(markup){
    var song_data = {
      // FIXME: wonder how text() handles HTML entities
      song     : markup.children('.song').text(),
      artist   : markup.children('.artist').text(),
      album    : markup.children('.album').text(),
      label    : markup.children('.label').text(),
      datetime : markup.find('.time span').text(),
      albumart : markup.find('.buy img').attr('src'),
      website  : markup.find('.details a').attr('href'),
      
      // these are added after the fact
      display_time   : null,
      albumart_hires : null
      
    };

    return song_data;
  }

  // accepts time string in KCRW format, returns moment.js time object
  function fixTimezone(datetime){
    // correct the time to be in user's timezone, not America/Los_Angeles, 
    // where KCRW is and what their dates are output as.
    // 
    // i need a way to *interpret* the time in America/Los_Angeles and then 
    // display it in the local time zone. you'd think this would be easy, but 
    // it's not, due to detecting and accounting for DST.
    // 
    // the simplest approach seems to be detect DST and then hardcode the # of 
    // hours offset when making a new date. this is nearly perfect except 
    // that during the DST transition, it will not be correct because we're 
    // testing DST based on *our* timezone, not LA's. at least that's what i 
    // *think* will happen. needs more testing in any case.
    // 
    // also note that the date is output without leading zeros for the hour:
    // 
    //   2013-10-07 5:38 am
    // 
    // Date.parse can handle this format (in chrome, at least), but 
    // Date.parse does not work well across browsers. (see 
    // <http://stackoverflow.com/questions/3085937/>) Instead, we're using 
    // moment.js and its ability to parse dates according to a specified 
    // format.
    // 
    var KCRW_DATETIME_FORMAT = "YYYY-MM-DD h:mm a";
    var song_start_datetime = moment(datetime, KCRW_DATETIME_FORMAT);

    // LA is -7 hours during DST, and -8 hours at other times
    var offset = song_start_datetime.isDST() ? "-0700" : "-0800";

    // re-parse with the correct GMT offset
    song_start_datetime = moment(datetime + ' GMT' + offset, (KCRW_DATETIME_FORMAT + " [GMT]Z"));

    return song_start_datetime;
  }

  function findLargerArtwork(term){

    function queryItunes(term){
      // docs: http://www.apple.com/itunes/affiliates/resources/documentation/itunes-store-web-service-search-api.html
      // 
      $.ajax({
        'type'     : 'GET',
        // 'async'    : false,
        'url'      : 'http://' + AJAX_HOSTNAME + '/search',
        'data'     : {
          "term"    : term,
          "media"   : 'music',
          "limit"   : 1
          // "entity"  : 'album',
          // "output"  : "json", 
          // "callback" : '',
          // "country" : 'US',
          // "lang"    : "EN",
        },
        'dataType' : 'json',
        'success'  : queryItunesSuccess,
        'error'    : handleResponseError
      });
    }

    function queryItunesSuccess(data){
      // we just requested one item, so check if it exists
      if (data.results[0]) {
        // make referencing it easier
        var results = data.results[0];

        // take the artwork from the first record returned.
        var large_artwork = results.artworkUrl100;

        // no, silly, we want the larger version of the artwork, please. kthxbai.
        // 
        //   http://a2.mzstatic.com/us/r30/Features/4f/ae/9b/dj.prvxtaxv.600x600-75.jpg
        // 
        large_artwork = large_artwork.replace(/100x100/, '600x600');

        // set the album art and store a ref to it
        $('#albumart').attr('src', large_artwork);
        current_song_data.albumart_hires = large_artwork;

        // link album title to itunes music store
        $('#album').html("<a href=\"" + results.collectionViewUrl + "\" target=\"_blank\">" + current_song_data.album + "</a>");

      } else {
        console.log("no artwork found on iTunes music store!");
        // mark as -1 if we didn't find anything
        current_song_data.albumart_hires = -1;
      }
    }

    queryItunes(term);
  }

  // shove the data into our page
  function displayNowPlayingData(data){
    // FIXME: handle special cases (breaks, announcements, etc.)

    // link artist name to their website, if available
    if (data.website) {
      $('#artist').html('<a href="' + data.website + '" target="_blank">' + data.artist + '<\/a>');
    } else {
      $('#artist').html(data.artist);
    }

    $('#song').html(data.song);

    // don't show the album line if there's no album data. it's cleaner that 
    // way.
    if (!data.album) {
      // FIXME: what about tracks that have no album info yet have label info?
      // edge case, for sure. maybe the label stanza needs to be combined with
      // this stanza
      $('#album-info').hide();
      $('#album').html("");
    } else {
      $('#album').html(data.album);
      $('#album-info').show();
    }

    // don't show the square parens if there's no label
    if (!data.label) {
      $('#label-info').hide();
      $('#label').html("");
    } else {
      $('#label').html(data.label);
      $('#label-info').show();
    }

    $('#time').html(data.display_time);

    // display default album art if no art is available
    if (!data.albumart) {
      $('#albumart').attr('src', DEFAULT_ALBUM_ART);
    } else {
      $('#albumart').attr('src', data.albumart);
    }

    // show everything now that we have data.
    // yeah, this will get called every time, but who cares. it's harmless. 
    $('#now-playing').removeClass('invisible');
  }

  function handleAlbumArtClick() {
    // stop the timer before we refresh the data
    clearTimeout(timeout);

    retrieveNowPlaying();
  }

  return {
    init : function(){
      retrieveNowPlaying();

      // hidden feature! click the album art to refresh
      $('#albumart').on('click', handleAlbumArtClick)
    }
  };

}());

KCRWBuddy.init();
