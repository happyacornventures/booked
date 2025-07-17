import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function CalendarList() {
  const [calendars, setCalendars] = useState<Calendar.Calendar[]>([]);
  const [booked, setBooked] = useState<Calendar.Calendar | null>(null);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [events, setEvents] = useState<Calendar.Event[]>([]);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [clearingBookedEvents, setClearingBookedEvents] = useState(false);

  useEffect(() => {
    // Load selected calendars from AsyncStorage when component mounts
    const loadSelectedCalendars = async () => {
      try {
        const savedCalendars = await AsyncStorage.getItem('calendars');
        if (savedCalendars !== null) {
          setSelectedCalendars(JSON.parse(savedCalendars));
        }
      } catch (error) {
        console.error('Error loading selected calendars:', error);
      }
    };

    loadSelectedCalendars();
    // ... rest of your existing useEffect code for fetching calendars
  }, []);

  useEffect(() => {
    // Save selected calendars to AsyncStorage whenever they change
    const saveSelectedCalendars = async () => {
      try {
        await AsyncStorage.setItem('calendars', JSON.stringify(selectedCalendars));
      } catch (error) {
        console.error('Error saving selected calendars:', error);
      }
    };

    saveSelectedCalendars();
  }, [selectedCalendars]);

  useEffect(() => {
    (async () => {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status === 'granted') {
        const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        setCalendars(cals);
      } else {
        console.warn('Calendar permission not granted');
      }
    })();
  }, []);

  useEffect(() => {
    const createDefaultCalendar = async () => {
        if (calendars.length === 0) return;
        let booked = calendars.find(cal => cal.title === 'Booked');
        if(booked) setBooked(booked);
        if (!booked) {
            const defaultCalendarSource = Platform.OS === 'ios'
                ? (await Calendar.getDefaultCalendarAsync()).source
                : { isLocalAccount: true, name: 'Booked', type: 'local' };

            const booked = await Calendar.createCalendarAsync({
                title: 'Booked',
                color: '#FF5733',
                entityType: Calendar.EntityTypes.EVENT,
                source: defaultCalendarSource,
                name: 'Booked',
                accessLevel: Calendar.CalendarAccessLevel.OWNER,
                ownerAccount: 'ghost',
            });
        }
    }

    createDefaultCalendar();

  }, [calendars]);

  const fetchEvents = async (calendars: string[], days: number = 14) => {
    if (calendars.length === 0) {
      return [];
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    let allEvents: Calendar.Event[] = [];

    for (const calendarId of calendars) {
      try {
        const calendarEvents = await Calendar.getEventsAsync(
          [calendarId],
          startDate,
          endDate
        );
        allEvents = [...allEvents, ...calendarEvents];
      } catch (error) {
        console.error(`Error fetching events for calendar ${calendarId}:`, error);
      }
    }

    return allEvents;
  };

  const fetchSelectedEvents = async () => {
    setEvents(await fetchEvents(selectedCalendars, 90));
  };

  useEffect(() => {
    fetchSelectedEvents();
  }, [selectedCalendars]);

    // clear booked calendar events
    const clearBookedEvents = async () => {
      if (!booked) return;
      try {
        const events = await Calendar.getEventsAsync([booked.id], new Date(), new Date(Date.now() + 1000 * 60 * 60 * 24 * 365));
        for (const event of events) {
          await Calendar.deleteEventAsync(event.id);
        }
      } catch (error) {
        console.error('Error clearing booked events:', error);
      }
    }

        // create a calendar event on booked for each event
    const createBookedEvents = async (events: Calendar.Event[]) => {
      if (!booked || events.length === 0) return;

      for (const event of events) {
        try {
          await Calendar.createEventAsync(booked.id, {
            title: "Busy",
            startDate: event.startDate,
            endDate: event.endDate,
            allDay: event.allDay,
            availability: event.availability,
            status: event.status,
          });
        } catch (error) {
          console.error('Error creating booked event:', error);
        }
      }
    }

  useEffect(() => {
    setClearingBookedEvents(true);
    clearBookedEvents().then(() => createBookedEvents(events)).then(() => setClearingBookedEvents(false));
  }, [events]);

  const toggleCalendarSelection = (calendarId: string) => {
    setSelectedCalendars(prevSelected =>
      prevSelected.includes(calendarId)
        ? prevSelected.filter(id => id !== calendarId)
        : [...prevSelected, calendarId]
    );
  };

  const toggleSourceExpansion = (sourceName: string) => {
    setExpandedSources(prevExpanded => ({
      ...prevExpanded,
      [sourceName]: !prevExpanded[sourceName],
    }));
  };

  const groupCalendarsBySource = (calendars: Calendar.Calendar[]) => {
    return calendars.reduce((groups, calendar) => {
      const sourceName = calendar.source.name;
      if (!groups[sourceName]) {
        groups[sourceName] = [];
      }
      groups[sourceName].push(calendar);
      return groups;
    }, {} as Record<string, Calendar.Calendar[]>);
  };

  const groupedCalendars = groupCalendarsBySource(calendars.filter(({title}) => title !== "Booked"));

  return (
    <ScrollView>
      <Text style={{ fontSize: 24, margin: 10, marginTop: 70 }}>Available Calendars:</Text>
      {Object.entries(groupedCalendars).map(([sourceName, cals]) => (
        <View key={sourceName}>
          <TouchableOpacity
            onPress={() => toggleSourceExpansion(sourceName)}
            style={{ flexDirection: 'row', alignItems: 'center', margin: 10 }}
          >
            <Ionicons
              name={expandedSources[sourceName] ? "chevron-down" : "chevron-forward"}
              size={24}
              color="white"
            />
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 10, color: "white" }}>{sourceName}</Text>
          </TouchableOpacity>
          {expandedSources[sourceName] && cals.map((cal) => (
            <TouchableOpacity
              key={cal.id}
              style={{ flexDirection: 'row', alignItems: 'center', margin: 10, marginLeft: 20 }}
              onPress={() => toggleCalendarSelection(cal.id)}
            >
              <Ionicons
                name={selectedCalendars.includes(cal.id) ? "checkbox-outline" : "square-outline"}
                size={24}
                color="white"
              />
              <View style={{ marginLeft: 10 }}>
                <Text style={{ color: "white" }}>Name: {cal.title}</Text>
                <Text style={{ color: "white" }}>Type: {cal.source.type}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <TouchableOpacity style={{ backgroundColor: 'cornflowerblue', padding: 10, margin: 10, borderRadius: 10 }} onPress={() => {
        setClearingBookedEvents(true);
        clearBookedEvents().then(createBookedEvents).then(() => setClearingBookedEvents(false));
      }}>
        <Text style={{ color: 'white', textAlign: 'center' }}>Sync Calendar</Text>
      </TouchableOpacity>
      {clearingBookedEvents && (
        <Text style={{ color: 'red', textAlign: 'center', margin: 10 }}>Clearing booked events...</Text>
      )}
    </ScrollView>
  );
}
